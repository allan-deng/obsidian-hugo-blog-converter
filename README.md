# Hugo 博客生成工具

这个 Obsidian 插件可以将 Obsidian 文档转换为 Hugo 博客格式。

## 功能

- 将 Obsidian 的 Wiki 链接转换为标准 Markdown 链接
  - `[[link.com]]` → `[link.com](link.com)`
  - `[[xxx.png]]` → `![xxx.png](./pic/xxx.png)`
- 自动生成/更新 YAML 头部信息（title、date、lastmod、slug、tags 等）
- 自动将中文标题翻译为英文 slug
- 复制关联的图片到博客目录
- 自动生成文章封面图（featured-image）

## 编译

### 环境要求

- Node.js (推荐 v18+)
- npm
- Go (用于编译封面图生成工具)

### 编译步骤

```bash
# 克隆项目
git clone <repo-url>
cd obsidian-hugo-blog-converter

# 一键编译（安装依赖 + 构建插件 + 编译 Go 工具）
sh build.sh

# 或者清理构建目录
sh build.sh clean
```

编译完成后，`build/` 目录包含：
- `main.js` - 插件主文件
- `manifest.json` - 插件清单
- `gen_pic` - 封面图生成工具
- `SmileySans-Oblique.ttf` - 封面图字体

## 安装

1. 找到你的 Obsidian 插件目录：`<vault>/.obsidian/plugins/`
2. 创建插件文件夹：`hugo-blog-converter/`
3. 将 `build/` 目录下的所有文件复制到该文件夹
4. 重启 Obsidian 或刷新插件列表
5. 在 Obsidian 设置 → 第三方插件 中启用 "Hugo Blog Converter"

```bash
# 示例安装命令
mkdir -p /path/to/vault/.obsidian/plugins/hugo-blog-converter
cp build/* /path/to/vault/.obsidian/plugins/hugo-blog-converter/
```

## 配置

在 Obsidian 设置 → Hugo Blog Converter 中配置：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **博客输出目录** (output_dir) | Hugo 站点的 content 目录，绝对路径 | `/Users/xxx/blog/content/posts` |
| **静态文件目录** (static_dir) | 图片存放的相对目录 | `pic` |
| **封面图工具地址** (gen_pic_tool) | gen_pic 可执行文件的绝对路径 | `/path/to/gen_pic` |

### 生成的目录结构

```
{output_dir}/
└── {slug}/                    # 根据标题自动生成的英文 slug
    ├── index.md               # 博客正文
    ├── featured-image.png     # 自动生成的封面图
    └── {static_dir}/          # 静态资源目录
        ├── pic1.png
        └── pic2.png
```

## 使用

1. 在 Obsidian 中打开要转换的 Markdown 文件
2. 点击左侧边栏的 **folder-sync** 图标，或使用命令面板执行 "convert blog"
3. 在弹出的对话框中编辑博客元数据（标题、slug、tags 等）
4. 点击"保存"完成转换

## 参考

https://github.com/kirito41dd/obsidian-hugo-publish