# png-merger

自动将项目中的零散png合并成雪碧图并修改css中的引用

### 测试

```bash
git clone https://github.com/rwson/png-merger.git

cd path/to/png-merger

npm install

npm test
```

### 使用

```bash
npm install png-merger -g

# 用法①
#Teiminal切到项目根目录下

#初始化雪碧图配置文件
png-merger init

#合并符合条件的png
png-merger

# 用法②

#Teiminal切到项目根目录下

#把配置项当成命令行参数传递
png-merger i=test/images i=test/imgs c=test l=0.7 s=200x200
```

### 参数说明

| 参数        | 简写           | 意义  |
|:------------- |:-------------|:-----|
| images      |i|图片目录, 支持多个|
| csses      |c|样式文件目录, 支持多个|
| level |l|优化级别, 0 ~ 1|
| size |s|图片尺寸小于等于width * height时, 才会被合并|

### 可能存在的问题

由于没有用`node-canvas`之类的模块,所以`png-merger`依赖了[puppeteer](https://github.com/GoogleChrome/puppeteer), 安装`puppeteer`时, 可能会下载`Chromium`, 所以需要提前设置下`PUPPETEER_DOWNLOAD_HOST`

```bash
export PUPPETEER_DOWNLOAD_HOST=https://storage.googleapis.com.cnpmjs.org

npm install png-merger -g	
```