import { App, PluginSettingTab, Setting } from "obsidian";
import HugoPublishPlugin from "./main";
import * as path from 'path';


export interface HugoPublishSettings {
    output_dir: string; // 博客输出位置
    static_dir: string; // 静态文件相对于 blog 的目录
    gen_pic_tool: string; // 生成标题图的工具
    get_output_dir: () => string;
}

export const DEFAULT_SETTINGS: HugoPublishSettings = {
    static_dir: "pic",
    output_dir: "",
    gen_pic_tool: "",
    get_output_dir(): string {
        return this.output_dir;
    }
}

export class HugoPublishSettingTab extends PluginSettingTab {
    plugin: HugoPublishPlugin;

    constructor(app: App, plugin: HugoPublishPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl('p', { text: `介绍：` });
        containerEl.createEl('p', { text: `生成的博客位置：` });
        containerEl.createEl('p', { text: `- {output_dir}` });
        containerEl.createEl('p', { text: `    - {slug} -- 生成 blog 时，会自动翻译生成` });
        containerEl.createEl('p', { text: `        - {static_dir}` });
        containerEl.createEl('p', { text: `            - pic1.png` });
        containerEl.createEl('p', { text: `            - pic2.png` });
        containerEl.createEl('p', { text: `        - index.md -- blog 正文` });
        containerEl.createEl('p', { text: `        - featured-image.png -- 标题图。使用 tool 生成` });


        new Setting(containerEl).setName("博客输出目录 output_dir").setDesc("博客输出的路径，绝对地址")
            .addText(text => text.setPlaceholder("/path/to/hugo/site").setValue(this.plugin.settings.output_dir).onChange(async (value) => {
                this.plugin.settings.output_dir = value;
                await this.plugin.saveSettings();
            }));
        new Setting(containerEl).setName("静态文件目录 static_dir").setDesc("博客中相关的静态文件路径，相对地址")
            .addText(text => text.setPlaceholder("static/dir").setValue(this.plugin.settings.static_dir).onChange(async (value) => {
                this.plugin.settings.static_dir = value;
                await this.plugin.saveSettings();
            }));
        new Setting(containerEl).setName("生成文章图像的工具地址 tool").setDesc('是一个可执行文件')
            .addText(text => text.setValue(this.plugin.settings.gen_pic_tool).onChange(async (value) => {
                this.plugin.settings.gen_pic_tool = value;
                await this.plugin.saveSettings();
            }));
    }
}

export const check_setting = (setting: HugoPublishSettings): boolean => {
    if (setting.static_dir.length == 0 || setting.static_dir.length == 0 || setting.gen_pic_tool.length == 0) {
        return false
    }
    return true;
}