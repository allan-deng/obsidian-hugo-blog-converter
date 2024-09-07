# Hugo 博客生成工具

这个插件可以将 Obsidian 文档，转换为 hugo 的博客

## 功能
这个插件会将 Obsidian 中的 `.md` 文件和相关图片转换到 Hugo 站点目录。并且会为 文章生成 封面图

转换包括：
- `[[link.com]]` -> `[link.com](link.com)`
- `[[xxx.png]]` -> `![xxx.png](./${static_dir}/xx.png)`
- 自动写入 md 的 yaml 头部信息，如：title, date, lastmod

## 如何使用

1. 完成插件设置：
2. 点击 `hugo sync` 按钮
3. 在弹出的对话框中输入博客的属性
4. 完成生成

## 参考
https://github.com/kirito41dd/obsidian-hugo-publish