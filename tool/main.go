package main

import (
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"io/ioutil"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"unicode"
	"unicode/utf8"

	"github.com/disintegration/imaging"
	"github.com/golang/freetype"
)

const unsplashAPI = "https://picsum.photos/1000/350"

type UnsplashResponse struct {
	Urls struct {
		Full string `json:"full"`
	} `json:"urls"`
}

func main() {
	// 解析命令行参数
	text := flag.String("text", "", "要添加的文字")
	outputPath := flag.String("output", "output.png", "输出文件路径")
	imageDir := flag.String("imageDir", "", "图片目录地址")
	flag.Parse()

	if *text == "" {
		log.Fatal("必须提供文字参数")
	}

	// 获取随机图像
	var img image.Image
	var err error

	if *imageDir != "" {
		img, err = getLargestImageFromDir(*imageDir)
	}

	if img == nil {
		// 获取随机图像
		img, err = getRandomImage()
		if err != nil {
			log.Fatalf("获取随机图像失败: %v", err)
		}
	}

	// 裁剪图像为 1:0.35 的比例
	img = cropToAspectRatio(img, 1, 0.35)

	// 缩放图像到 1000x350 像素
	img = imaging.Resize(img, 1000, 350, imaging.Lanczos)

	// 高斯模糊
	blurredImg := imaging.Blur(img, 2.0)

	// 增加黑色不透明层
	overlay := image.NewRGBA(blurredImg.Bounds())
	draw.Draw(overlay, overlay.Bounds(), &image.Uniform{color.RGBA{0, 0, 0, 80}}, image.Point{}, draw.Over)
	draw.Draw(blurredImg, blurredImg.Bounds(), overlay, image.Point{}, draw.Over)

	// 在图像上添加白色文字
	finalImg := addTextToImage(blurredImg, *text)

	// 保存图像
	err = saveImage(finalImg, *outputPath)
	if err != nil {
		log.Fatalf("保存图像失败: %v", err)
	}

	fmt.Println("图像已保存到", *outputPath)
}

func getRandomImage() (image.Image, error) {
	// 调用 picsum API 获取随机图像，增加重试机制
	const maxRetries = 3
	var resp *http.Response
	var err error
	for i := 0; i < maxRetries; i++ {
		resp, err = http.Get(unsplashAPI)
		if err == nil && resp.StatusCode == http.StatusOK {
			break
		}
		if i < maxRetries-1 {
			log.Printf("调用 picsum API 失败, 重试中 (%d/%d): %v", i+1, maxRetries, err)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("调用 picsum API 失败: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("picsum API 返回错误状态: %v", resp.Status)
	}

	// var unsplashResp UnsplashResponse
	// if err := json.NewDecoder(resp.Body).Decode(&unsplashResp); err != nil {
	// 	return nil, fmt.Errorf("解析 Unsplash API 响应失败: %v", err)
	// }

	// // 下载图像
	// imgResp, err := http.Get(unsplashResp.Urls.Full)
	// if err != nil {
	// 	return nil, fmt.Errorf("下载图像失败: %v", err)
	// }
	// defer imgResp.Body.Close()

	img, err := imaging.Decode(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("解码图像失败: %v", err)
	}

	return img, nil
}

func addTextToImage(img image.Image, text string) image.Image {

	const (
		maxFontSize = 150.0
		dpi         = 72
	)
	fontSize := 100.0

	// 加载字体
	// 获取当前可执行文件所在的目录
	execPath, err := os.Executable()
	if err != nil {
		log.Fatalf("获取可执行文件路径失败: %v", err)
	}
	execDir := filepath.Dir(execPath)

	// 加载字体文件
	fontPath := filepath.Join(execDir, "SmileySans-Oblique.ttf")
	fontBytes, err := ioutil.ReadFile(fontPath)
	if err != nil {
		log.Fatalf("读取字体文件失败: %v", err)
	}
	font, err := freetype.ParseFont(fontBytes)
	if err != nil {
		log.Fatalf("解析字体失败: %v", err)
	}

	// 创建带阴影的文字图像
	rgba := image.NewRGBA(img.Bounds())
	draw.Draw(rgba, rgba.Bounds(), img, image.Point{}, draw.Over)

	c := freetype.NewContext()
	c.SetDPI(dpi)
	c.SetFont(font)
	// c.SetFontSize(fontSize)
	c.SetClip(rgba.Bounds())
	c.SetDst(rgba)
	c.SetSrc(image.Black)

	// 计算字体大小：
	// 计算字体大小

	textLen := utf8.RuneCountInString(text)
	fontSize = (1000 - 100) / float64(textLen)
	if textLen <= 15 {
		fontSize = math.Min(fontSize, maxFontSize)
	} else {
		fontSize = 90
	}
	c.SetFontSize(fontSize)

	// 计算文本布局
	lines := wordWrap(text, 15) // 假设每行最多30个字符

	// 计算文本总高度
	textHeight := len(lines) * int(c.PointToFixed(fontSize)>>6)

	// 绘制阴影
	c.SetSrc(image.Black)
	for i, line := range lines {
		// 计算文本宽度
		maxWidth := 0
		width := getTextWidth(c, line)
		if width > maxWidth {
			maxWidth = width
		}

		// 计算起始点，使文本水平和垂直居中
		startX := (rgba.Bounds().Dx() - maxWidth) / 2
		startY := (rgba.Bounds().Dy()-textHeight)/2 + int(c.PointToFixed(fontSize)>>6)
		pt := freetype.Pt(startX, startY)

		_, err = c.DrawString(line, pt.Add(freetype.Pt(2, 2+int(c.PointToFixed(fontSize*float64(i))>>6))))
		if err != nil {
			log.Fatalf("绘制阴影失败: %v", err)
		}
	}

	// 绘制白色文字
	c.SetSrc(image.White)
	for i, line := range lines {

		// 计算文本宽度
		maxWidth := 0
		width := getTextWidth(c, line)
		if width > maxWidth {
			maxWidth = width
		}

		// 计算起始点，使文本水平和垂直居中
		startX := (rgba.Bounds().Dx() - maxWidth) / 2
		startY := (rgba.Bounds().Dy()-textHeight)/2 + int(c.PointToFixed(fontSize)>>6)
		pt := freetype.Pt(startX, startY)

		_, err = c.DrawString(line, pt.Add(freetype.Pt(0, int(c.PointToFixed(fontSize*float64(i))>>6))))
		if err != nil {
			log.Fatalf("绘制文字失败: %v", err)
		}
	}

	return rgba
}

func getTextWidth(c *freetype.Context, text string) int {
	pt := freetype.Pt(0, -10000)
	advance, err := c.DrawString(text, pt)
	if err != nil {
		log.Fatalf("计算文本宽度失败: %v", err)
	}
	return int(advance.X >> 6)
}

func wordWrap(text string, lineWidth int) []string {
	var lines []string
	for len(text) > 0 {
		if utf8.RuneCountInString(text) <= lineWidth {
			lines = append(lines, text)
			break
		}

		// 找到第 lineWidth 个字符的索引
		idx := 0
		lastSpace := -1
		for i, r := range text {
			if unicode.IsSpace(r) {
				lastSpace = i
			}
			if idx == lineWidth {
				if lastSpace != -1 {
					lines = append(lines, text[:lastSpace])
					text = text[lastSpace+1:]
				} else {
					lines = append(lines, text[:i])
					text = text[i:]
				}
				break
			}
			idx++
		}
	}
	return lines
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func saveImage(img image.Image, path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	switch ext := getFileExtension(path); ext {
	case ".png":
		return png.Encode(file, img)
	case ".jpg", ".jpeg":
		return jpeg.Encode(file, img, nil)
	default:
		return fmt.Errorf("不支持的文件格式: %s", ext)
	}
}

func getFileExtension(path string) string {
	if len(path) < 4 {
		return ""
	}
	return path[len(path)-4:]
}

func getLargestImageFromDir(dir string) (image.Image, error) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("读取目录失败: %v", err)
	}

	var largestImg image.Image
	var largestSize int64

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		filePath := dir + "/" + file.Name()
		fileInfo, err := os.Stat(filePath)
		if err != nil {
			continue
		}

		// 只处理图片文件
		if !isImageFile(filePath) {
			continue
		}

		if fileInfo.Size() > largestSize {
			imgFile, err := os.Open(filePath)
			if err != nil {
				continue
			}
			defer imgFile.Close()

			img, err := imaging.Decode(imgFile)
			if err != nil {
				continue
			}

			largestImg = img
			largestSize = fileInfo.Size()
		}
	}

	if largestImg == nil {
		return nil, fmt.Errorf("目录中没有有效的图像文件")
	}

	return largestImg, nil
}

func isImageFile(path string) bool {
	ext := getFileExtension(path)
	switch ext {
	case ".png", ".jpg", ".jpeg":
		return true
	default:
		return false
	}
}

func cropToAspectRatio(img image.Image, aspectWidth, aspectHeight float64) image.Image {
	srcBounds := img.Bounds()
	srcWidth := float64(srcBounds.Dx())
	srcHeight := float64(srcBounds.Dy())

	srcAspect := srcWidth / srcHeight
	targetAspect := aspectWidth / aspectHeight

	var targetWidth, targetHeight float64
	if srcAspect > targetAspect {
		// 宽度过大，裁剪宽度
		targetHeight = srcHeight
		targetWidth = targetHeight * targetAspect
	} else {
		// 高度过大，裁剪高度
		targetWidth = srcWidth
		targetHeight = targetWidth / targetAspect
	}

	x0 := (srcWidth - targetWidth) / 2
	y0 := (srcHeight - targetHeight) / 2
	x1 := x0 + targetWidth
	y1 := y0 + targetHeight

	return imaging.Crop(img, image.Rect(int(x0), int(y0), int(x1), int(y1)))
}
