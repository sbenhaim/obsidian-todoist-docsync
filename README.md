# Obsidian Todoist Docsync

This plugin provides one-way sync of tasks from [Todoist](https://todoist.com/) to [Obsidian](https://obsidian.md/) markdown files, using frontmatter to represent Todoist task properties.

## Setup Instructions
### API Key
### Auto-Sync
### Archiving Completed
### Querying with DataView
### MetaData Menu
### Frontmatter Title
### Archive folder

## Motiviation
There are several task-management plugins for Obsidian, including the very popular and featureful [Tasks](https://publish.obsidian.md/tasks/Introduction), as well as a couple of plugins specifically for syncing between Obsidian and Todoist, so why add to an already crowded space?

Simple--I wanted file-based tasks. All other solutions use markdown checkboxes, which is sensible in that they already _look_ like tasks, you can complete theme with a satisfying click of the mouse, and they're easy to embed in a larger context by simply adding them to an existing markdown file. 

But file-based todos present a number of advantages over checkboxes:

## Room for Context
Sometimes my tasks come with baggage in the form of information that is helpful in completing the task, but not necessarily beyond that. Notes, comments, files, links. Sometimes a little, sometimes a lot. Checkbox-based task solutions simply don't have _room_ for all this, as these tasks are confined to a single line.

## All the Metadata
The Tasks plugin above does a commendable job in enhancing built-in Obsidian checkboxes with a pile of metadata to make task management considerably more powerful. But you want _all the metadata_? Go with a markdown file, and throw anything you want in the frontmatter. Due date, start date, end date, priority, tags, links, completion time, owner, depends on, blocking... whatever. Plus, you can use something like [MetaData Menu]() to really beef up your task metadata.

## Easy Archiving
I'm a hoarder in liking to keep things around just in case, but a minimalist in not wanting to look at it. So neither deleting tasks nor letting them lie around is satisfying to me. Instead, I want an archive option, and moving completed task files to an "ignored" folder in Obsidian is as simple as it is effective.

## Okay, then why Todoist
For all Obisidian's strengths, there are a couple of limitations that prevent it from being a great standalone task management system (for me, anyway).

### Easy Capture
Capturing and filing todos quickly is a Todoist strength using the quickadd interface in both desktop and mobile. Obsidian has a great mobile app, but sync takes time and quick mobile capture just isn't quite seemless.

### App Integration
Todoist has integration for Gmail browser and Mobile, Outlook, browser extensions, and integration with numerous other apps and services.

### Time and Location based alerts on Mobile
