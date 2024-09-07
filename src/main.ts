// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, parseYaml, stringifyYaml, Setting } from 'obsidian';
import { DEFAULT_SETTINGS, HugoPublishSettings, HugoPublishSettingTab, check_setting } from './setting';

import * as util from "./util";
import * as path from 'path';
import axios from 'axios';
import { visit } from 'unist-util-visit'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { remark } from 'remark';
import { newlineToBreak } from 'mdast-util-newline-to-break'

import { math } from 'micromark-extension-math'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math'
import { toMarkdown } from 'mdast-util-to-markdown'
import { gfmTable } from 'micromark-extension-gfm-table'
import { gfmTableFromMarkdown, gfmTableToMarkdown } from 'mdast-util-gfm-table'
import { pid } from 'process';


// Remember to rename these classes and interfaces!



export default class HugoPublishPlugin extends Plugin {
	settings: HugoPublishSettings;
	base_path: string;

	async onload() {
		await this.loadSettings();
		this.settings.get_output_dir();
		// get base path
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			this.base_path = this.app.vault.adapter.getBasePath();
		} else {
			console.error("can't get base path");
			return;
		}

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('folder-sync', 'hugo convert blog', async (evt: MouseEvent) => {
			await this.convert_blog();
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync-blog',
			name: 'convert blog',
			callback: async () => {
				// new SampleModal(this.app).open();
				await this.convert_blog();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new HugoPublishSettingTab(this.app, this));

	}

	onunload() {

	}

	async convert_blog() {
		// 执行一篇文档的转换
		if (!check_setting(this.settings)) {
			new Notice('Error: 缺少插件配置!');
			return;
		}

		const blog = await this.getCurrentFile()
		if (blog == null) {
			new Notice('Error: 当前没有打开的博客!');
			return;
		}

		new Notice('开始处理博客 [' + blog.path + ']...');


		const content = await this.app.vault.read(blog);
		const stat = await this.app.vault.adapter.stat(blog.path);

		//  -------- header处理 -------- //
		new Notice('step1: header 生成...');
		// 解析文件内容中的 YAML 头部
		let [header, body] = util.get_md_yaml_hader_from_content(content)
		let hv = parseYaml(header);
		if (!hv) { hv = {}; }

		// hugo 的 header 结构
		/*
		---
		# 文本的标题
		title: "巴菲特、查理芒格、雷达里奥对比特币的看法"
		# slug 
		slug: "buffett-charlie-munger-and-dalio-views-on-bitcoin"
		
		# 时间，可以从 obsidian 获取
		date: 2019-05-06T13:04:28+08:00
		lastmod: 2019-05-06T13:04:28+08:00
		
		# 下面为固定信息
		# 是否为草稿状态
		draft: false
		name: Allan
		link: "https://allandeng.cn"
		avatar: "/images/avatar.png"
		resources:
		- name: "featured-image"
		  src: "featured-image.png"
		featuredImage: "featured-image"

		# tag 和 分类
		tags: ["阅读"]
		categories: ["阅读感受"]
		---
		 */

		// 设置标题、创建时间和修改时间
		const header_obj = new HeaderObj();


		// 处理 title
		let title = ""
		if ("title" in hv) {
			title = hv["title"]
		} else {
			title = path.parse(blog.name).name;
		}
		header_obj.title = title;

		// 处理 时间
		if (stat) {
			const creat_at = new Date(stat?.ctime).toISOString();
			const modify_at = new Date(stat?.mtime).toISOString()
			header_obj.date = creat_at;
			header_obj.lastmod = modify_at;
		} else {
			const creat_at = new Date().toISOString();
			const modify_at = new Date().toISOString()
			header_obj.date = creat_at;
			header_obj.lastmod = modify_at;
		}

		// 处理 tags
		if ("tags" in hv && Array.isArray(hv["tags"]) && hv["tags"].length > 0) {
			header_obj.tags = hv["tags"];
		}

		// 处理 slug
		if ("slug" in hv && hv["slug"] && typeof hv["slug"] === "string") {
			header_obj.slug = hv["slug"];
		} else {
			// 使用免费的翻译API将中文title翻译为英文并处理为slug
			const translateAPI = "https://api.mymemory.translated.net/get";

			try {
				const params = new URLSearchParams({
					q: title,
					langpair: 'zh|en'
				});

				const response = await axios.get(`${translateAPI}?${params}`);
				const data = response.data;

				if (data && data.responseData && data.responseData.translatedText) {
					const englishTitle = data.responseData.translatedText;
					header_obj.slug = englishTitle.toLowerCase().replace(/\s+/g, '-');
				} else {
					console.error("翻译API返回结果异常");
					header_obj.slug = title.toLowerCase().replace(/\s+/g, '-');
				}
			} catch (error) {
				console.error("调用翻译API失败:", error);
				header_obj.slug = title.toLowerCase().replace(/\s+/g, '-');
			}
		}

		// new HeaderObjModal(this.app, header_obj).open()
		await new Promise<void>((resolve) => {
			const modal = new HeaderObjModal(this.app, header_obj);
			modal.onClose = () => {
				if (modal.isCancelled) {
					new Notice('已取消');
					return; // 直接返回，不继续后续逻辑
				}
				resolve();
			};
			modal.open();
		});

		// 将更新后的 YAML 头部转换为字符串
		header = stringifyYaml(header_obj);

		console.log("header\n", header, "hv", header_obj);

		let blog_path = header_obj.slug
		console.log("blog dst path:", blog_path);

		new Notice('step1: header 生成...');

		// ------- 正文处理 -------//
		new Notice('step2: 正文 生成...');

		// 博客目录 /output_dir/slug
		// 图片目录目录 /output_dir/slug/pics
		const dst = path.join(this.settings.get_output_dir(), blog_path);
		const pic_dst = path.join(dst, this.settings.static_dir);
		const dst_doc = path.join(dst, "index.md");
		console.log("dst: ",dst,",pic ",pic_dst,",doc ",dst_doc)

		{
			// 转换为 ast 
			const ast = fromMarkdown(body, {
				extensions: [math(), gfmTable()],
				mdastExtensions: [mathFromMarkdown(), gfmTableFromMarkdown()]
			})

			// 处理换行符
			newlineToBreak(ast);


			// 转换图像和链接
			util.transform_wiki_image(ast);
			util.transform_wiki_link(ast);


			const meta = this.app.metadataCache.getFileCache(blog);

			// link -> path,is_md
			const link2path: Map<string, [string, boolean]> = new Map();

			const abf = this.app.vault.getAbstractFileByPath(blog.path);
			// copy files to blog dir
			if (abf) {
				//const src = path.join(this.base_path, abf.path);


				// 处理嵌入的文件
				if (meta?.embeds) {
					// 复制 嵌入的图像文件到 和 blog 的 pics 目录下
					let pic_index = 0
					for (const v of meta.embeds) {
						const embed_f = this.app.metadataCache.getFirstLinkpathDest(v.link, blog.path);
						if (embed_f) {

							const src = path.join(this.base_path, embed_f.path);

							// 目标为 ./{static_dir}/{slug}-{index}.{ext}
							const ext = path.extname(embed_f.path);
							let file_name = blog_path + "-" + pic_index + ext;
							const dst = path.join(pic_dst, file_name);

							pic_index++;

							link2path.set(v.link, [file_name, false]);

							console.log(`copy ${src} to ${dst}`);
							await util.copy_file(src, dst);
						}
					}
				}

				// 处理连接
				if (meta?.links) {
					for (const v of meta.links) {
						const link_f = this.app.metadataCache.getFirstLinkpathDest(v.link, blog.path);
						//console.log("link", v.link, link_f);
						if (link_f) {
							let is_md = false;
							if (link_f.path.endsWith(".md")) {
								is_md = true;
								link2path.set(v.link, [v.link, is_md]);
							}
						}
					}
				}

				console.log("link2path", link2path, "meta", meta)

				let static_dir = this.settings.static_dir
				// 进行图片文件的 url 替换
				// 替换为  {static_dir} / {filename}
				visit(ast, 'image', function (node, index, parent) {
					const decoded_url = decodeURI(node.url);
					const v = link2path.get(decoded_url)
					if (v) {
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						const [vv, _is_md] = v;
						node.url = encodeURI(path.join(static_dir, vv).replace(/\\/g, '/'));
					}
				})
				visit(ast, 'link', function (node, index, parent) {
					const decoded_url = decodeURI(node.url);
					const v = link2path.get(decoded_url)
					if (v) {
						const [vv, is_md] = v;
						if (is_md) {
							// inner md link:  [[abc]] -> [](/abc) -> https://www.blog.com/abc
							node.url = encodeURI(path.join("/", vv).replace(/\\/g, '/'));
						} else {
							node.url = encodeURI(path.join("/", static_dir, vv).replace(/\\/g, '/'));
						}
					}
				})

				// body = remark.stringify(ast);
				body = toMarkdown(ast, { extensions: [mathToMarkdown(), gfmTableToMarkdown()] });

				await util.write_md(dst_doc, header, body)
			}

		}
		new Notice('step2: 正文 生成 done');
		// ----- 生成标题图 ------
		new Notice('step3: 标题图 生成...');
		{
			await util.generateTitleImage(this.settings.gen_pic_tool, header_obj.title, path.join(dst, 'featured-image.png'), pic_dst);
		}
		new Notice('step3: 标题图 生成 done.');
		
		new Notice('处理完成 [' + blog.path + ']...');
	}


	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async getCurrentFile() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			const fileName = activeFile.name; // 获取文件名
			console.log("当前打开的文件:", fileName);
			return activeFile;
		} else {
			console.log("没有打开的文件");
			return null;
		}
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class HugoPublishModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}


class HeaderObjModal extends Modal {
	headerObj: HeaderObj;
	isCancelled: boolean = true; 

	constructor(app: App, headerObj: HeaderObj) {
		super(app);
		this.headerObj = headerObj;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'blog 元数据编辑' });

		// 定义不需要显示的元素
		const hiddenKeys = ['resources', 'featuredImage'];
		for (const key of Object.keys(this.headerObj)) {
			// 过滤掉不需要显示的元素
			if (hiddenKeys.includes(key)) continue;

			const value = this.headerObj[key as keyof HeaderObj];
			new Setting(contentEl)
				.setName(key)
				.addText(text => text
					.setValue(Array.isArray(value) ? value.join(', ') : value.toString())
					.onChange(async (newValue) => {
						if (key === 'tags') {
							this.headerObj[key] = newValue.split(',').map(tag => tag.trim());
						} else {
							(this.headerObj as any)[key] = newValue;
						}
					}));
		}

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('保存')
				.setCta()
				.onClick(() => {
					this.isCancelled = false; // 点击保存时设置标志为 false
					console.log("更新后的 headerObj：", this.headerObj);
					this.close();
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}


class HeaderObj {
	title: string;
	slug: string;
	date: string;
	lastmod: string;
	tags: string[];
	categories: string[];
	draft: boolean;
	name: string;
	link: string;
	avatar: string;
	resources: { name: string; src: string }[];
	featuredImage: string;

	constructor() {
		this.title = "";
		this.slug = "";
		this.date = "";
		this.lastmod = "";
		this.tags = [""];
		this.categories = [""];
		this.draft = false;
		this.name = "Allan";
		this.link = "https://allandeng.cn";
		this.avatar = "/images/avatar.png";
		this.resources = [
			{
				name: "featured-image",
				src: "featured-image.png"
			}
		];
		this.featuredImage = "featured-image";
	}
}