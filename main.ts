import { App, Plugin, PluginSettingTab, Setting, TFile,
	normalizePath, Notice,
	TFolder
 } from 'obsidian';
import { TodoistApi, Project, Section, Task } from "@doist/todoist-api-typescript";
import axios from 'axios';
import open from 'open';
const yaml = require('js-yaml');

// Todoist Endpoints
const BASE_URI = 'https://api.todoist.com'
const API_REST_BASE_URI = '/rest/v2/'
export const API_SYNC_BASE_URI = '/sync/v9/'
const TODOIST_URI = 'https://todoist.com'
const API_AUTHORIZATION_BASE_URI = '/oauth/'
const DESKTOP_URL_PROTOCOL = 'todoist'

function getRestBaseUri(domainBase: string = BASE_URI): string {
    return new URL(API_REST_BASE_URI, domainBase).toString()
}

function getSyncBaseUri(domainBase: string = BASE_URI): string {
    return new URL(API_SYNC_BASE_URI, domainBase).toString()
}

export const ENDPOINT_SYNC_QUICK_ADD = 'quick/add'

// Remember to rename these classes and interfaces!

interface OTDSSettings {
	key: string;
	directory: string;
	projectDirectory: string;
	fileClass: string;
	syncToken: string;
	autoSyncFrequency: number;
	titleFrontMatterKey: string;
}

interface QuickAddOptions {
	due?: any;
	project?: string;
	priority?: number;
	label?: string;
	recurrence?: string;
	description?: string;
}

const DEFAULT_SETTINGS: OTDSSettings = {
	key: 'Todoist API key goes here.',
	directory: 'Todo',
	projectDirectory: 'Projects',
	fileClass: '',
	syncToken: '*',
	autoSyncFrequency: 0,
	titleFrontMatterKey: 'alias',
}


export default class MyPlugin extends Plugin {
	settings: OTDSSettings;
	api: any;
	intervalId: number | null = null;

	async onload() {
		await this.loadSettings();


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'otds-sync',
			name: 'Sync',
			callback: () => {
				this.sync(true);
			}
		});

		this.addCommand({
			id: 'otds-sync-all',
			name: 'Sync All',
			callback: () => {
				this.settings.syncToken = '*';
				this.sync(true);
			}
		});


		this.addCommand({
			id: 'otds-create-task-from-file',
			name: 'Create Task from this File',
			callback: async () => {
				const file = this.app.workspace.getActiveFile();

				if (! file) {
					return;
				}

				const md = this.app.metadataCache;
				const opts = md.getFileCache(file).frontmatter as QuickAddOptions;
				const name = file.basename;

				let fileUrl = this.obsidianUrl(file);

				let contents = await this.app.vault.cachedRead(file);
				contents = contents.replace(/^---\n.*?\n---\n/s, '').trim();

				let description = fileUrl;

				if (opts.description) {
					description = opts.description + " " + description;
				}

				this.quickAdd(name, description, opts);

			}
		})

		this.addCommand({
			id: 'otds-archive-completed',
			name: 'Archive Completed Tasks',
			callback: async () => {

				// Move all tasks to the Completed subfolder of the task folder
				let taskFolder = normalizePath(this.settings.directory);
				let completedFolder = normalizePath(taskFolder + '/Completed');

				if (this.app.vault.getAbstractFileByPath(completedFolder) == null) {
					this.app.vault.createFolder(normalizePath(completedFolder));
				}

				let tf:TFolder = this.app.vault.getFolderByPath(taskFolder) as TFolder;

				for ( let file of tf.children ) {
					if (file instanceof TFile) {

						let fm:any = this.app.metadataCache.getFileCache(file)?.frontmatter;

						if (fm && fm.completed && fm.completed !== '') {
							this.app.vault.rename(file, normalizePath(completedFolder + '/' + file.basename));
						}
					}
				}

			}
		})

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new OTDSSettingTab(this.app, this));


		this.updateAutoSync();

	}

	updateAutoSync() {
		if (this.intervalId) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}

		if (this.settings.autoSyncFrequency > 0) {
			this.intervalId = this.registerInterval(window.setInterval(() => {
				this.sync();
			}, this.settings.autoSyncFrequency * 1000));
		}
		else {
			this.intervalId = null;
		}
	}

	async getProjects():Promise<Project[]> {
		return this.getApi().getProjects();
	}

	async getSections():Promise<Section[]> {
		return this.getApi().getSections();
	}

	obsidianUrl(file:TFile) {
		// obsidian://open?vault=Corpus&file=Tasks%2FScratch
		let path = file.path;
		let vaultName = this.app.vault.getName();
		return `obsidian://open?vault=${vaultName}&file=${path}`;
	}

	getApi():any {
		if (this.api) {
			return this.api;
		}
		else {
			this.api = new TodoistApi(this.settings.key);
			return this.api;
		}
	}


	async quickAdd(name:string, description:string, options:QuickAddOptions) {

		let priority = options.priority ? ` p${options.priority}` : '';
		let project = options.project ? ` #${options.project}` : '';
		let label = options.label ? ` @${options.label}` : '';
		let recurrence = options.recurrence ? ` ${options.recurrence} starting` : '';

		let due:string;

		if (options.due) {
			due = " " + options.due.replace(/(\d)T(\d)/, '$1 $2').replace(/(..:..):../, '$1');
		}
		else {
			due = '';
		}


		let optStr = priority + project + label + recurrence + due;

		let content = `${name} ${optStr} // ${description}`;

		console.log(content);

		let result:any = await axios.post(getSyncBaseUri() + ENDPOINT_SYNC_QUICK_ADD, {
			text: content,
			auto_reminder: true
		}, {
			headers: {
				'Authorization': `Bearer ${this.settings.key}`,
				'Content-Type': 'application/json'
			}
		});
	}

	async sync(notify?:boolean):Promise<any> {

		if (notify) {
			new Notice('Syncing with Todoist...');
		}
		else {
			console.log('Syncing with Todoist...');
		}

		if (this.app.vault.getAbstractFileByPath(this.settings.directory) == null) {
			this.app.vault.createFolder(normalizePath(this.settings.directory));
		}

		if (notify) {
			new Notice('Fetching Projects...');
		}
		else {
			console.log('Fetching Projects...');
		}

		const projects:Project[] = await this.getProjects();

		const projectMap: { [id:string]: Project } = projects.reduce((map, project) => {
			map[project.id] = project;
			return map;
		}, {} as { [id:string]: Project });


		if (notify) {
			new Notice('Fetching Sections...');
		}
		else {
			console.log('Fetching Sections...');
		}

		const sections:Section[] = await this.getSections();
		const sectionMap: { [id:string]: Section } = sections.reduce((map, section) => {
			map[section.id] = section;
			return map;
		}, {} as { [id:string]: Section });

		console.log("Project Map:", projectMap);
		console.log("Section Map:", sectionMap);

		console.log( "Sync Token: ", this.settings.syncToken );

		if (notify) {
			new Notice('Fetching Tasks...');
		}
		else {
			console.log('Fetching Tasks...');
		}

		let result:any = await axios.post(getSyncBaseUri() + 'sync',
			{
				sync_token: this.settings.syncToken,
				resource_types: '["all"]'
			},
			{
				headers: {
					'Authorization': `Bearer ${this.settings.key}`,
					'Content-Type': 'application/json'
				}
			}
		);

		console.log('Sync response:', result);

		if (notify) {
			new Notice('Writing Task files...');
		}
		else {
			console.log('Writing Task files...');
		}

		const tasks:any = result.data.items;
		for (let task of tasks) {
			this.updateTask(task, projectMap[task.project_id], sectionMap[task.section_id]);
		}

		this.settings.syncToken = result.data.sync_token;
		console.log('Sync Token: ', this.settings.syncToken);
		this.saveSettings();
	}


	updateTask(task:Task, project?:Project, section?:Section) {

		const fp:string = this.settings.directory + '/' + task.id + '.md';

		if (task.is_deleted) {
			this.app.vault.adapter.remove(normalizePath(fp));
			return;
		}

		let metadata:any = {
			link: `${DESKTOP_URL_PROTOCOL}://task?id=${task.id}`,
			due: task.due?.date,
			priority: task.priority,
			project: project?.name,
			section: section?.name,
			recurrence: task.due?.string,
			labels: task.labels.map((id) => id.toString()),
			created: task.added_at,
			completed: task.completed_at,
		};

		metadata[this.settings.titleFrontMatterKey] = task.content;

		if (project && this.settings.projectDirectory !== '') {
			metadata.projectLink = `[[/${this.settings.projectDirectory}/${project.name}/`;
			if ( section ) {
				metadata.projectLink += section.name + '/' + section.name + ']]';
			}
			else {
				metadata.projectLink += project.name + ']]';
			}
		}

		if (this.settings.fileClass !== '') {
			metadata.class = this.settings.fileClass;
		}


		const yamlStr = yaml.dump(metadata);


		const fileStr = `---\n${yamlStr}---\n${task.description}`;
		let file = this.app.vault.adapter.write(normalizePath(fp), fileStr);

		return file;
	}


	onunload() {
		if (this.intervalId) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class OTDSSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Todoist API Key')
			.setDesc('<url>')
			.addText(text => text
				.setPlaceholder('Todoist API Key')
				.setValue(this.plugin.settings.key)
				.onChange(async (value) => {
					this.plugin.settings.key = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Task Directory')
			.setDesc('Directory synced tasks will reside.')
			.addText(text => text
				.setPlaceholder('Tasks')
				.setValue(this.plugin.settings.directory)
				.onChange(async (value) => {
					this.plugin.settings.directory = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Project Directory')
			.setDesc('Directory where project links will point.')
			.addText(text => text
				.setPlaceholder('Projects')
				.setValue(this.plugin.settings.projectDirectory)
				.onChange(async (value) => {
					this.plugin.settings.projectDirectory = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Metadata File Class')
			.setDesc('File class for use with Metadata Menu plugin.')
			.addText(text => text
				.setPlaceholder('todoist')
				.setValue(this.plugin.settings.fileClass)
				.onChange(async (value) => {
					this.plugin.settings.fileClass = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Sync Frequency')
			.setDesc('Sync interval in seconds. 0 to disable.')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(this.plugin.settings.autoSyncFrequency.toString())
				.onChange(async (value) => {
					this.plugin.settings.autoSyncFrequency = parseFloat(value);
					await this.plugin.saveSettings();
					this.plugin.updateAutoSync();
				}));

		new Setting(containerEl)
			.setName('Title Front Matter Key')
			.setDesc('Front matter key to use for title. If using the "Front Matter Title" plugin, set this to match the key used there.')
			.addText(text => text
				.setPlaceholder('alias')
				.setValue(this.plugin.settings.titleFrontMatterKey)
				.onChange(async (value) => {
					this.plugin.settings.titleFrontMatterKey = value;
					await this.plugin.saveSettings();
				}));

	}
}
