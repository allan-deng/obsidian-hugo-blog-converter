#!/bin/bash

# Function to clean the build directory
clean() {
    echo "Cleaning build directory..."
    rm -rf build
    echo "Build directory cleaned."
}

# Check for the clean argument
if [ "$1" == "clean" ]; then
    clean
    exit 0
fi

# Step 1: 执行 npm run build
npm run build

# Step 2: copy manifest.json 到 build 目录
cp manifest.json build/

# Step 3: 在 tool 目录下执行 go build
cd tool
go build

# Step 4: 把 gen_pic copy 到 build 目录
cp gen_pic ../build/

cp SmileySans-Oblique.ttf ../build/

# 返回初始目录
cd ..