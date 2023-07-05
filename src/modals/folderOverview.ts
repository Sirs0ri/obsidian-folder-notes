import { App, Modal, Setting, MarkdownPostProcessorContext, stringifyYaml, TFile } from 'obsidian';
import { yamlSettings } from 'src/folderOverview';
import FolderNotesPlugin from '../main';
import ListComponent from 'src/functions/ListComponent';
export class FolderOverviewSettings extends Modal {
	plugin: FolderNotesPlugin;
	app: App;
	yaml: yamlSettings;
	ctx: MarkdownPostProcessorContext;
	el: HTMLElement;
	constructor(app: App, plugin: FolderNotesPlugin, yaml: yamlSettings, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
		super(app);
		this.plugin = plugin;
		this.app = app;
		this.yaml = yaml;
		this.ctx = ctx;
		this.el = el;
		if (!this.yaml) {
			this.yaml = {
				title: this.plugin.settings.defaultOverview.title,
				disableTitle: this.plugin.settings.defaultOverview.disableTitle,
				depth: this.plugin.settings.defaultOverview.depth,
				type: this.plugin.settings.defaultOverview.type,
				includeTypes: this.plugin.settings.defaultOverview.includeTypes,
				style: this.plugin.settings.defaultOverview.style,
				disableCanvasTag: this.plugin.settings.defaultOverview.disableCanvasTag,
				sortBy: this.plugin.settings.defaultOverview.sortBy,
			};
		}
	}
	onOpen() {
		this.display();
	}
	display() {
		const { contentEl } = this;
		contentEl.empty();
		// close when user presses enter
		contentEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				this.close();
			}
		});
		contentEl.createEl('h2', { text: 'Folder overview settings' });
		new Setting(contentEl)
			.setName('Disable the title')
			.setDesc('Choose if the title should be shown')
			.addToggle((toggle) =>
				toggle
					.setValue(this.yaml.disableTitle || false)
					.onChange(async (value) => {
						this.yaml.disableTitle = value;
						this.display();
						await this.updateYaml();
					})
			);
		if (!this.yaml.disableTitle) {
			new Setting(contentEl)
				.setName('Title')
				.setDesc('Choose the title of the folder overview')
				.addText((text) =>
					text
						.setValue(this.yaml?.title || 'Folder overview')
						.onChange(async (value) => {
							this.yaml.title = value;
							await this.updateYaml();
						})
				);
		}
		const setting = new Setting(contentEl);
		setting.setName('Include types');
		const list = setting.createList((list: ListComponent) =>
			list
				.addModal(this)
				.setValues(this.yaml?.includeTypes || this.plugin.settings.defaultOverview.includeTypes || [])
				.addResetButton()
		);
		if ((this.yaml?.includeTypes?.length || 0) < 3) {
			setting.addDropdown((dropdown) => {
				if (!this.yaml.includeTypes) this.yaml.includeTypes = this.plugin.settings.defaultOverview.includeTypes || [];
				this.yaml.includeTypes = this.yaml.includeTypes.map((type: string) => type.toLowerCase());
				if (!this.yaml.includeTypes.includes('markdown')) {
					dropdown.addOption('Markdown', 'Markdown');
				}
				if (!this.yaml.includeTypes.includes('folder')) {
					dropdown.addOption('Folder', 'Folder');
				}
				if (!this.yaml.includeTypes.includes('canvas')) {
					dropdown.addOption('Canvas', 'Canvas');
				}
				dropdown.addOption('+', '+');
				dropdown.setValue('+');
				dropdown.onChange(async (value) => {
					// @ts-ignore
					await list.addValue(value.toLowerCase());
					await this.updateYaml();
					this.display();
				});
			});
		}
		if (this.yaml.includeTypes?.includes('canvas')) {
			new Setting(contentEl)
				.setName('Disable canvas tag')
				.setDesc('Choose if the canvas tag should be shown')
				.addToggle((toggle) => {
					toggle
						.setValue(this.yaml.disableCanvasTag || this.plugin.settings.defaultOverview.disableCanvasTag || false)
						.onChange(async (value) => {
							this.yaml.disableCanvasTag = value;
							await this.updateYaml();
						});
				});
		}

		new Setting(contentEl)
			.setName('File depth')
			.setDesc('File & folder = +1 depth')
			.addSlider((slider) =>
				slider
					.setValue(this.yaml?.depth || 1)
					.setLimits(1, 10, 1)
					.onChange(async (value) => {
						this.yaml.depth = value;
						await this.updateYaml();
					})
			);

		new Setting(contentEl)
			.setName('Overview style')
			.setDesc('Choose the style of the overview (grid style soon)')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('list', 'List')
					.setValue(this.yaml?.style || 'list')
					.onChange(async (value: 'list') => {
						this.yaml.style = value;
						await this.updateYaml();
					})
			);

		new Setting(contentEl)
			.setName('Sort files by')
			.setDesc('Choose how the files should be sorted')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('name', 'Name descending')
					.addOption('created', 'Created descending')
					.addOption('modified', 'Modified descending')
					.addOption('nameAsc', 'Name ascending')
					.addOption('createdAsc', 'Created ascending')
					.addOption('modifiedAsc', 'Modified ascending')
					.setValue(this.yaml?.sortBy || 'name')
					.onChange(async (value: 'name' | 'created' | 'modified' | 'nameAsc' | 'createdAsc' | 'modifiedAsc') => {
						this.yaml.sortBy = value;
						await this.updateYaml();
					})
			);


	}
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
	async updateYaml() {
		const file = this.plugin.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
		if (!(file instanceof TFile)) return;
		let stringYaml = stringifyYaml(this.yaml);
		await this.plugin.app.vault.process(file, (text) => {
			const info = this.ctx.getSectionInfo(this.el);
			// check if stringYaml ends with a newline
			if (stringYaml[stringYaml.length - 1] !== '\n') {
				stringYaml += '\n';
			}
			if (info) {
				const { lineStart } = info;
				const lineEnd = this.getCodeBlockEndLine(text, lineStart);
				if (lineEnd === -1 || !lineEnd) return text;
				const lineLength = lineEnd - lineStart;
				const lines = text.split('\n');
				lines.splice(lineStart, lineLength + 1, `\`\`\`folder-overview\n${stringYaml}\`\`\``);
				return lines.join('\n');
			}
			return `\`\`\`folder-overview\n${stringYaml}\`\`\``;
		});
	}
	getCodeBlockEndLine(text: string, startLine: number, count = 1) {
		let line = startLine + 1;
		const lines = text.split('\n');
		while (line < lines.length) {
			if (count > 20) { return -1; }
			if (lines[line].startsWith('```')) {
				return line;
			}
			line++;
			count++;
		}
		return line;
	}
}

