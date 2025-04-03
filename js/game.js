// 游戏主类
class RubiksCubeGame {
    constructor() {
        // 获取画布
        this.canvas = document.getElementById("renderCanvas");
        // 创建引擎
        this.engine = new BABYLON.Engine(this.canvas, true);
        
        // 初始化属性
        this.cubeSize = 3; // 3x3x3魔方
        this.cubePieces = []; // 初始化为空数组
        this.selectedFace = null;
        
        // 提示系统
        this.hintSystem = {
            currentStep: 0,
            steps: [],
            isActive: false
        };
        
        // 交互状态
        this.isDragging = false;
        this.lastDragTime = 0;
        this.dragThreshold = 5; // 拖动阈值
        this.rotationSpeed = 0.2; // 调整旋转速度
        
        // 创建场景
        this.scene = this.createScene();
        
        // 初始化交互
        this.setupInput();
        
        // 旋转状态
        this.isRotating = false;
        this.currentRotation = null;
        
        // 打乱状态
        this.isScrambling = false;
        this.scrambleMoves = [];
        this.scrambleLength = 20; // 默认打乱步数
        
        // 添加打乱按钮
        this.createScrambleButton();
        
        // 计时状态
        this.timer = 0;
        this.isTimerRunning = false;
        this.bestTime = localStorage.getItem('rubiksCubeBestTime') || null;
        this.timerInterval = null;
        
        // 添加计时器UI
        this.createTimerUI();
        
        // 完成状态
        this.isChecking = false;
        this.checkInterval = null;
        
        // 添加完成检查
        this.startCompletionCheck();
        
        // 统计信息
        this.solveTimes = JSON.parse(localStorage.getItem('rubiksCubeSolveTimes') || '[]');
        this.currentSessionTimes = [];
        this.averageOf = 5; // 计算最近5次的平均成绩
        this.bestAverage = localStorage.getItem('rubiksCubeBestAverage') || null;
        
        // 添加统计信息UI
        this.createStatsUI();
        
        // 运行渲染循环
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
        
        // 处理窗口大小变化
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }
    
    // 创建场景
    createScene() {
        const scene = new BABYLON.Scene(this.engine);
        
        // 创建相机
        const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(this.canvas, true);
        
        // 创建灯光
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;
        
        // 创建魔方
        this.createRubiksCube();
        
        return scene;
    }
    
    // 创建魔方
    createRubiksCube() {
        const size = 1;
        const gap = 0.1;
        
        // 定义魔方的颜色
        const colors = {
            front: new BABYLON.Color3(0, 0.5, 0),    // 绿色
            back: new BABYLON.Color3(0, 0, 0.5),     // 蓝色
            left: new BABYLON.Color3(0.5, 0.25, 0),  // 橙色
            right: new BABYLON.Color3(0.5, 0, 0),    // 红色
            up: new BABYLON.Color3(1, 1, 1),         // 白色
            down: new BABYLON.Color3(1, 1, 0)        // 黄色
        };
        
        // 创建魔方的各个小块
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    // 跳过中心块
                    if (x === 0 && y === 0 && z === 0) continue;
                    
                    // 创建魔方块
                    const piece = BABYLON.MeshBuilder.CreateBox("piece", {
                        size: size - gap
                    }, this.scene);
                    
                    piece.position = new BABYLON.Vector3(x * size, y * size, z * size);
                    
                    // 创建材质
                    const material = new BABYLON.StandardMaterial("pieceMaterial", this.scene);
                    
                    // 根据位置设置颜色
                    if (z === 1) {
                        material.diffuseColor = colors.front;
                    } else if (z === -1) {
                        material.diffuseColor = colors.back;
                    } else if (x === 1) {
                        material.diffuseColor = colors.right;
                    } else if (x === -1) {
                        material.diffuseColor = colors.left;
                    } else if (y === 1) {
                        material.diffuseColor = colors.up;
                    } else if (y === -1) {
                        material.diffuseColor = colors.down;
                    } else {
                        material.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
                    }
                    
                    material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                    material.emissiveColor = material.diffuseColor.scale(0.1);
                    
                    piece.material = material;
                    this.cubePieces.push(piece);
                }
            }
        }
    }
    
    // 开始完成检查
    startCompletionCheck() {
        // 每秒检查一次魔方是否完成
        this.checkInterval = setInterval(() => {
            if (!this.isRotating && !this.isScrambling) {
                this.checkCompletion();
            }
        }, 1000);
    }
    
    // 检查魔方是否完成
    checkCompletion() {
        if (this.isChecking) return;
        this.isChecking = true;
        
        // 检查每个面的颜色是否一致
        const faces = {
            front: [],  // z = 1
            back: [],   // z = -1
            right: [],  // x = 1
            left: [],   // x = -1
            up: [],     // y = 1
            down: []    // y = -1
        };
        
        // 收集每个面的颜色
        this.cubePieces.forEach(piece => {
            const pos = piece.position;
            const color = piece.material.diffuseColor;
            
            if (Math.abs(pos.z - 1) < 0.1) faces.front.push(color);
            if (Math.abs(pos.z + 1) < 0.1) faces.back.push(color);
            if (Math.abs(pos.x - 1) < 0.1) faces.right.push(color);
            if (Math.abs(pos.x + 1) < 0.1) faces.left.push(color);
            if (Math.abs(pos.y - 1) < 0.1) faces.up.push(color);
            if (Math.abs(pos.y + 1) < 0.1) faces.down.push(color);
        });
        
        // 检查每个面的颜色是否一致
        const isComplete = Object.values(faces).every(faceColors => {
            if (faceColors.length === 0) return true;
            const firstColor = faceColors[0];
            return faceColors.every(color => 
                Math.abs(color.r - firstColor.r) < 0.01 &&
                Math.abs(color.g - firstColor.g) < 0.01 &&
                Math.abs(color.b - firstColor.b) < 0.01
            );
        });
        
        if (isComplete) {
            this.onCubeComplete();
        }
        
        this.isChecking = false;
    }
    
    // 魔方完成时的处理
    onCubeComplete() {
        // 停止计时器
        this.stopTimer();
        
        // 显示完成消息
        this.showCompletionMessage();
    }
    
    // 显示完成消息
    showCompletionMessage() {
        const message = document.createElement('div');
        message.textContent = '恭喜完成！';
        message.style.position = 'absolute';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.fontSize = '48px';
        message.style.color = '#00ff00';
        message.style.textShadow = '3px 3px 6px rgba(0,0,0,0.5)';
        message.style.zIndex = '1000';
        message.style.animation = 'fadeOut 2s forwards';
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(message);
        
        // 2秒后移除消息
        setTimeout(() => {
            document.body.removeChild(message);
            document.head.removeChild(style);
        }, 2000);
    }
    
    // 旋转魔方的一个面
    rotateFace(face, direction) {
        // TODO: 实现面旋转逻辑
    }
    
    // 处理触摸/鼠标事件
    setupInput() {
        // 添加鼠标/触摸事件监听
        this.canvas.addEventListener("pointerdown", this.onPointerDown.bind(this));
        this.canvas.addEventListener("pointermove", this.onPointerMove.bind(this));
        this.canvas.addEventListener("pointerup", this.onPointerUp.bind(this));
        this.canvas.addEventListener("pointercancel", this.onPointerUp.bind(this));
        
        // 添加键盘事件监听
        window.addEventListener("keydown", this.onKeyDown.bind(this));
        
        // 添加手势事件监听
        this.canvas.addEventListener("gesturestart", this.onGestureStart.bind(this));
        this.canvas.addEventListener("gesturechange", this.onGestureChange.bind(this));
        this.canvas.addEventListener("gestureend", this.onGestureEnd.bind(this));
    }
    
    // 鼠标/触摸按下事件
    onPointerDown(event) {
        event.preventDefault();
        const pickResult = this.scene.pick(event.clientX, event.clientY);
        
        if (pickResult.hit && pickResult.pickedMesh) {
            this.isDragging = true;
            this.selectedPiece = pickResult.pickedMesh;
            this.startPosition = new BABYLON.Vector2(event.clientX, event.clientY);
            this.lastDragTime = Date.now();
            
            // 添加视觉反馈
            this.highlightSelectedPiece(this.selectedPiece);
        }
    }
    
    // 鼠标/触摸移动事件
    onPointerMove(event) {
        if (!this.isDragging || !this.selectedPiece || this.isRotating) return;
        
        event.preventDefault();
        const currentPosition = new BABYLON.Vector2(event.clientX, event.clientY);
        const delta = currentPosition.subtract(this.startPosition);
        
        // 计算移动方向和速度
        const direction = this.calculateDragDirection(delta);
        const speed = this.calculateDragSpeed(delta);
        
        // 如果移动距离超过阈值，开始旋转
        if (delta.length() > this.dragThreshold) {
            this.startRotation({
                axis: direction.axis,
                layer: direction.layer,
                direction: direction.direction * speed
            });
        }
    }
    
    // 鼠标/触摸释放事件
    onPointerUp(event) {
        if (this.isDragging) {
            event.preventDefault();
            this.isDragging = false;
            
            // 移除视觉反馈
            if (this.selectedPiece) {
                this.removeHighlight(this.selectedPiece);
            }
            
            this.selectedPiece = null;
            this.startPosition = null;
        }
    }
    
    // 键盘事件
    onKeyDown(event) {
        if (this.isRotating) return;
        
        const key = event.key.toLowerCase();
        const rotations = {
            'f': { axis: 'z', layer: 1, direction: 1 },  // 前面顺时针
            'b': { axis: 'z', layer: -1, direction: -1 }, // 后面顺时针
            'l': { axis: 'x', layer: -1, direction: 1 },  // 左面顺时针
            'r': { axis: 'x', layer: 1, direction: -1 },  // 右面顺时针
            'u': { axis: 'y', layer: 1, direction: 1 },   // 上面顺时针
            'd': { axis: 'y', layer: -1, direction: -1 }  // 下面顺时针
        };
        
        if (rotations[key]) {
            this.startRotation(rotations[key]);
        }
    }
    
    // 手势开始事件
    onGestureStart(event) {
        event.preventDefault();
        this.isRotating = true;
    }
    
    // 手势变化事件
    onGestureChange(event) {
        if (!this.isRotating) return;
        event.preventDefault();
        
        // 处理缩放
        const scale = event.scale;
        if (scale !== 1) {
            this.zoomCamera(scale);
        }
        
        // 处理旋转
        const rotation = event.rotation;
        if (rotation !== 0) {
            this.rotateCamera(rotation);
        }
    }
    
    // 手势结束事件
    onGestureEnd(event) {
        event.preventDefault();
        this.isRotating = false;
    }
    
    // 计算拖动方向
    calculateDragDirection(delta) {
        const absX = Math.abs(delta.x);
        const absY = Math.abs(delta.y);
        const clickedPiece = this.selectedPiece;
        
        // 根据点击的块的位置确定旋转轴和层
        if (absX > absY) {
            // 水平拖动
            return {
                axis: 'y',
                layer: Math.sign(clickedPiece.position.y),
                direction: Math.sign(delta.x)
            };
        } else {
            // 垂直拖动
            return {
                axis: 'x',
                layer: Math.sign(clickedPiece.position.x),
                direction: Math.sign(delta.y)
            };
        }
    }
    
    // 计算拖动速度
    calculateDragSpeed(delta) {
        const currentTime = Date.now();
        const timeDelta = currentTime - this.lastDragTime;
        const speed = delta.length() / timeDelta;
        this.lastDragTime = currentTime;
        
        // 限制速度范围
        return Math.min(Math.max(speed, 0.5), 2.0);
    }
    
    // 高亮选中的块
    highlightSelectedPiece(piece) {
        // 移除高亮效果，保持原始颜色
    }
    
    // 移除高亮
    removeHighlight(piece) {
        // 恢复原始材质
        this.applyOriginalMaterials(piece);
    }
    
    // 应用原始材质
    applyOriginalMaterials(piece) {
        // TODO: 实现原始材质的恢复
    }
    
    // 缩放相机
    zoomCamera(scale) {
        const camera = this.scene.activeCamera;
        if (camera instanceof BABYLON.ArcRotateCamera) {
            camera.radius *= scale;
        }
    }
    
    // 旋转相机
    rotateCamera(rotation) {
        const camera = this.scene.activeCamera;
        if (camera instanceof BABYLON.ArcRotateCamera) {
            camera.alpha += rotation * 0.01;
        }
    }
    
    // 开始旋转
    startRotation(rotation) {
        if (this.isRotating) return;
        
        this.isRotating = true;
        this.currentRotation = rotation;
        
        // 获取需要旋转的块
        const piecesToRotate = this.getPiecesToRotate(rotation);
        
        // 创建旋转动画
        this.animateRotation(piecesToRotate, rotation);
    }
    
    // 获取需要旋转的块
    getPiecesToRotate(rotation) {
        const clickedPiece = this.selectedPiece;
        return this.cubePieces.filter(piece => {
            const pos = piece.position;
            const clickedPos = clickedPiece.position;
            
            // 根据旋转轴和点击的块的位置确定要旋转的列
            switch (rotation.axis) {
                case 'x':
                    // 只旋转与点击的块在同一列的块
                    return Math.abs(pos.x - clickedPos.x) < 0.1;
                case 'y':
                    // 只旋转与点击的块在同一列的块
                    return Math.abs(pos.y - clickedPos.y) < 0.1;
                case 'z':
                    // 只旋转与点击的块在同一列的块
                    return Math.abs(pos.z - clickedPos.z) < 0.1;
                default:
                    return false;
            }
        });
    }
    
    // 动画旋转
    animateRotation(pieces, rotation) {
        const targetAngle = Math.PI / 2 * rotation.direction;
        let currentAngle = 0;
        
        const animate = () => {
            if (currentAngle >= Math.abs(targetAngle)) {
                this.finishRotation(pieces, rotation);
                return;
            }
            
            const step = this.rotationSpeed * Math.sign(targetAngle);
            currentAngle += Math.abs(step);
            
            pieces.forEach(piece => {
                switch (rotation.axis) {
                    case 'x':
                        piece.rotation.x += step;
                        break;
                    case 'y':
                        piece.rotation.y += step;
                        break;
                    case 'z':
                        piece.rotation.z += step;
                        break;
                }
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    // 完成旋转
    finishRotation(pieces, rotation) {
        // 更新块的位置
        pieces.forEach(piece => {
            const pos = piece.position.clone();
            switch (rotation.axis) {
                case 'x':
                    if (rotation.layer === 1) {
                        piece.position = new BABYLON.Vector3(pos.x, -pos.z, pos.y);
                    } else {
                        piece.position = new BABYLON.Vector3(pos.x, pos.z, -pos.y);
                    }
                    break;
                case 'y':
                    if (rotation.layer === 1) {
                        piece.position = new BABYLON.Vector3(pos.z, pos.y, -pos.x);
                    } else {
                        piece.position = new BABYLON.Vector3(-pos.z, pos.y, pos.x);
                    }
                    break;
                case 'z':
                    if (rotation.layer === 1) {
                        piece.position = new BABYLON.Vector3(-pos.y, pos.x, pos.z);
                    } else {
                        piece.position = new BABYLON.Vector3(pos.y, -pos.x, pos.z);
                    }
                    break;
            }
            // 重置旋转
            piece.rotation = BABYLON.Vector3.Zero();
        });
        
        this.isRotating = false;
        this.currentRotation = null;
        
        // 检查完成状态
        this.checkCompletion();
    }
    
    // 创建打乱按钮
    createScrambleButton() {
        const button = document.createElement('button');
        button.textContent = '打乱魔方';
        button.style.position = 'absolute';
        button.style.top = '20px';
        button.style.left = '20px';
        button.style.padding = '10px 20px';
        button.style.fontSize = '16px';
        button.style.cursor = 'pointer';
        button.style.zIndex = '1000';
        document.body.appendChild(button);
        
        button.addEventListener('click', () => {
            if (!this.isScrambling && !this.isRotating) {
                this.scrambleCube();
            }
        });
    }
    
    // 创建计时器UI
    createTimerUI() {
        // 先检查是否已存在计时器UI，如果存在则移除
        const existingTimer = document.getElementById('timerContainer');
        if (existingTimer) {
            existingTimer.remove();
        }

        // 创建计时器容器
        const timerContainer = document.createElement('div');
        timerContainer.id = 'timerContainer';
        timerContainer.style.position = 'absolute';
        timerContainer.style.top = '20px';
        timerContainer.style.right = '20px';
        timerContainer.style.textAlign = 'center';
        timerContainer.style.zIndex = '1000';
        timerContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        timerContainer.style.padding = '15px';
        timerContainer.style.borderRadius = '10px';
        
        // 创建计时器显示
        const timerDisplay = document.createElement('div');
        timerDisplay.id = 'timerDisplay';
        timerDisplay.style.fontSize = '32px';
        timerDisplay.style.marginBottom = '10px';
        timerDisplay.style.color = '#ffffff';
        timerDisplay.style.fontFamily = 'monospace';
        timerDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        timerDisplay.textContent = '00:00.00';
        
        // 创建最佳成绩显示
        const bestTimeDisplay = document.createElement('div');
        bestTimeDisplay.id = 'bestTimeDisplay';
        bestTimeDisplay.style.fontSize = '14px';
        bestTimeDisplay.style.marginBottom = '15px';
        bestTimeDisplay.style.color = '#ffffff';
        bestTimeDisplay.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
        
        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'center';
        
        // 创建开始/停止按钮
        const toggleButton = document.createElement('button');
        toggleButton.textContent = '开始计时';
        toggleButton.style.padding = '8px 16px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.backgroundColor = '#4CAF50';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '4px';
        
        // 创建重置按钮
        const resetButton = document.createElement('button');
        resetButton.textContent = '重置';
        resetButton.style.padding = '8px 16px';
        resetButton.style.cursor = 'pointer';
        resetButton.style.backgroundColor = '#f44336';
        resetButton.style.color = 'white';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '4px';
        
        // 添加事件监听
        toggleButton.addEventListener('click', () => {
            this.toggleTimer();
            toggleButton.textContent = this.isTimerRunning ? '停止计时' : '开始计时';
            toggleButton.style.backgroundColor = this.isTimerRunning ? '#f44336' : '#4CAF50';
        });
        resetButton.addEventListener('click', () => {
            this.resetTimer();
            toggleButton.textContent = '开始计时';
            toggleButton.style.backgroundColor = '#4CAF50';
        });
        
        // 组装UI
        buttonContainer.appendChild(toggleButton);
        buttonContainer.appendChild(resetButton);
        timerContainer.appendChild(timerDisplay);
        timerContainer.appendChild(bestTimeDisplay);
        timerContainer.appendChild(buttonContainer);
        document.body.appendChild(timerContainer);
        
        // 更新显示
        this.updateTimerDisplay();
        this.updateBestTimeDisplay();
    }
    
    // 更新计时器显示
    updateTimerDisplay() {
        const timerDisplay = document.getElementById('timerDisplay');
        const minutes = Math.floor(this.timer / 60);
        const seconds = Math.floor(this.timer % 60);
        const milliseconds = Math.floor((this.timer % 1) * 100);
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    
    // 更新最佳成绩显示
    updateBestTimeDisplay() {
        const bestTimeDisplay = document.getElementById('bestTimeDisplay');
        if (this.bestTime) {
            const minutes = Math.floor(this.bestTime / 60);
            const seconds = Math.floor(this.bestTime % 60);
            const milliseconds = Math.floor((this.bestTime % 1) * 100);
            bestTimeDisplay.textContent = `最佳成绩: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        } else {
            bestTimeDisplay.textContent = '最佳成绩: --:--.--';
        }
    }
    
    // 切换计时器状态
    toggleTimer() {
        if (this.isTimerRunning) {
            this.stopTimer();
        } else {
            this.startTimer();
        }
    }
    
    // 开始计时
    startTimer() {
        if (!this.isTimerRunning) {
            this.isTimerRunning = true;
            this.timerInterval = setInterval(() => {
                this.timer += 0.01;
                this.updateTimerDisplay();
            }, 10);
        }
    }
    
    // 停止计时
    stopTimer() {
        if (this.isTimerRunning) {
            this.isTimerRunning = false;
            clearInterval(this.timerInterval);
            
            // 记录成绩
            this.recordSolveTime(this.timer);
            
            // 检查是否打破最佳成绩
            if (!this.bestTime || this.timer < this.bestTime) {
                this.bestTime = this.timer;
                localStorage.setItem('rubiksCubeBestTime', this.bestTime);
                this.updateBestTimeDisplay();
                this.showNewRecordMessage();
            }
        }
    }
    
    // 重置计时器
    resetTimer() {
        this.stopTimer();
        this.timer = 0;
        this.updateTimerDisplay();
    }
    
    // 显示新记录消息
    showNewRecordMessage() {
        const message = document.createElement('div');
        message.textContent = '新记录！';
        message.style.position = 'absolute';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.fontSize = '48px';
        message.style.color = '#ffd700';
        message.style.textShadow = '3px 3px 6px rgba(0,0,0,0.5)';
        message.style.zIndex = '1000';
        message.style.animation = 'fadeOut 2s forwards';
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(message);
        
        // 2秒后移除消息
        setTimeout(() => {
            document.body.removeChild(message);
            document.head.removeChild(style);
        }, 2000);
    }
    
    // 生成打乱步骤
    generateScramble() {
        const moves = [];
        const axes = ['x', 'y', 'z'];
        const layers = [-1, 1];
        const directions = [-1, 1];
        
        // 生成随机步骤
        for (let i = 0; i < this.scrambleLength; i++) {
            const axis = axes[Math.floor(Math.random() * axes.length)];
            const layer = layers[Math.floor(Math.random() * layers.length)];
            const direction = directions[Math.floor(Math.random() * directions.length)];
            
            // 避免连续两次旋转同一个面
            if (i > 0) {
                const lastMove = moves[moves.length - 1];
                if (lastMove.axis === axis && lastMove.layer === layer) {
                    i--; // 重新生成这一步
                    continue;
                }
            }
            
            moves.push({
                axis: axis,
                layer: layer,
                direction: direction
            });
        }
        
        return moves;
    }

    // 修改打乱魔方方法
    scrambleCube() {
        if (this.isScrambling || this.isRotating) return;
        
        this.isScrambling = true;
        this.scrambleMoves = this.generateScramble();
        
        // 重置计时器
        this.resetTimer();
        
        // 执行打乱
        this.executeScramble(0);
    }
    
    // 修改执行打乱方法
    executeScramble(index) {
        if (index >= this.scrambleMoves.length) {
            this.isScrambling = false;
            return;
        }
        
        const move = this.scrambleMoves[index];
        const piecesToRotate = this.cubePieces.filter(piece => {
            const pos = piece.position;
            switch (move.axis) {
                case 'x': return Math.abs(pos.x - move.layer) < 0.1;
                case 'y': return Math.abs(pos.y - move.layer) < 0.1;
                case 'z': return Math.abs(pos.z - move.layer) < 0.1;
                default: return false;
            }
        });

        // 直接更新块的位置，不使用动画
        piecesToRotate.forEach(piece => {
            const pos = piece.position.clone();
            switch (move.axis) {
                case 'x':
                    if (move.layer === 1) {
                        piece.position = new BABYLON.Vector3(pos.x, -pos.z, pos.y);
                    } else {
                        piece.position = new BABYLON.Vector3(pos.x, pos.z, -pos.y);
                    }
                    break;
                case 'y':
                    if (move.layer === 1) {
                        piece.position = new BABYLON.Vector3(pos.z, pos.y, -pos.x);
                    } else {
                        piece.position = new BABYLON.Vector3(-pos.z, pos.y, pos.x);
                    }
                    break;
                case 'z':
                    if (move.layer === 1) {
                        piece.position = new BABYLON.Vector3(-pos.y, pos.x, pos.z);
                    } else {
                        piece.position = new BABYLON.Vector3(pos.y, -pos.x, pos.z);
                    }
                    break;
            }
            // 重置旋转
            piece.rotation = BABYLON.Vector3.Zero();
        });
        
        // 立即执行下一步
        this.executeScramble(index + 1);
    }
    
    // 创建统计信息UI
    createStatsUI() {
        // 创建统计信息容器
        const statsContainer = document.createElement('div');
        statsContainer.style.position = 'absolute';
        statsContainer.style.bottom = '20px';
        statsContainer.style.left = '20px';
        statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        statsContainer.style.padding = '15px';
        statsContainer.style.borderRadius = '10px';
        statsContainer.style.color = '#ffffff';
        statsContainer.style.zIndex = '1000';
        
        // 创建统计信息标题
        const statsTitle = document.createElement('h3');
        statsTitle.textContent = '统计信息';
        statsTitle.style.margin = '0 0 10px 0';
        statsTitle.style.textAlign = 'center';
        
        // 创建统计信息显示区域
        const statsContent = document.createElement('div');
        statsContent.id = 'statsContent';
        
        // 创建清除统计按钮
        const clearStatsButton = document.createElement('button');
        clearStatsButton.textContent = '清除统计';
        clearStatsButton.style.marginTop = '10px';
        clearStatsButton.style.padding = '5px 10px';
        clearStatsButton.style.cursor = 'pointer';
        clearStatsButton.addEventListener('click', () => this.clearStatistics());
        
        // 组装UI
        statsContainer.appendChild(statsTitle);
        statsContainer.appendChild(statsContent);
        statsContainer.appendChild(clearStatsButton);
        document.body.appendChild(statsContainer);
        
        // 更新统计信息显示
        this.updateStatsDisplay();
    }
    
    // 更新统计信息显示
    updateStatsDisplay() {
        const statsContent = document.getElementById('statsContent');
        statsContent.innerHTML = '';
        
        // 计算统计信息
        const stats = this.calculateStatistics();
        
        // 创建统计信息项
        const createStatItem = (label, value) => {
            const item = document.createElement('div');
            item.style.margin = '5px 0';
            item.innerHTML = `<strong>${label}:</strong> ${value}`;
            return item;
        };
        
        // 添加统计信息
        statsContent.appendChild(createStatItem('最快成绩', this.formatTime(stats.bestTime)));
        statsContent.appendChild(createStatItem('最慢成绩', this.formatTime(stats.worstTime)));
        statsContent.appendChild(createStatItem('平均成绩', this.formatTime(stats.average)));
        statsContent.appendChild(createStatItem('最近5次平均', this.formatTime(stats.averageOf5)));
        statsContent.appendChild(createStatItem('最佳5次平均', this.formatTime(stats.bestAverage)));
        statsContent.appendChild(createStatItem('总还原次数', stats.totalSolves));
    }
    
    // 计算统计信息
    calculateStatistics() {
        const times = this.solveTimes;
        if (times.length === 0) {
            return {
                bestTime: '--:--.--',
                worstTime: '--:--.--',
                average: '--:--.--',
                averageOf5: '--:--.--',
                bestAverage: this.bestAverage ? this.formatTime(this.bestAverage) : '--:--.--',
                totalSolves: 0
            };
        }
        
        // 计算基本统计
        const bestTime = Math.min(...times);
        const worstTime = Math.max(...times);
        const average = times.reduce((a, b) => a + b, 0) / times.length;
        
        // 计算最近5次平均
        let averageOf5 = '--:--.--';
        if (times.length >= 5) {
            const last5 = times.slice(-5);
            averageOf5 = last5.reduce((a, b) => a + b, 0) / 5;
        }
        
        return {
            bestTime,
            worstTime,
            average,
            averageOf5,
            bestAverage: this.bestAverage,
            totalSolves: times.length
        };
    }
    
    // 格式化时间
    formatTime(time) {
        if (time === '--:--.--') return time;
        
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const milliseconds = Math.floor((time % 1) * 100);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    
    // 清除统计信息
    clearStatistics() {
        if (confirm('确定要清除所有统计信息吗？')) {
            this.solveTimes = [];
            this.currentSessionTimes = [];
            this.bestAverage = null;
            localStorage.removeItem('rubiksCubeSolveTimes');
            localStorage.removeItem('rubiksCubeBestAverage');
            this.updateStatsDisplay();
        }
    }
    
    // 记录还原时间
    recordSolveTime(time) {
        // 添加到总记录
        this.solveTimes.push(time);
        localStorage.setItem('rubiksCubeSolveTimes', JSON.stringify(this.solveTimes));
        
        // 添加到当前会话记录
        this.currentSessionTimes.push(time);
        
        // 检查是否打破最佳平均成绩
        if (this.currentSessionTimes.length >= this.averageOf) {
            const recentAverage = this.calculateAverage(this.currentSessionTimes.slice(-this.averageOf));
            if (!this.bestAverage || recentAverage < this.bestAverage) {
                this.bestAverage = recentAverage;
                localStorage.setItem('rubiksCubeBestAverage', this.bestAverage);
            }
        }
        
        // 更新统计显示
        this.updateStatsDisplay();
    }
    
    // 计算平均成绩
    calculateAverage(times) {
        if (times.length === 0) return 0;
        return times.reduce((a, b) => a + b, 0) / times.length;
    }

    // 创建提示按钮
    createHintButton() {
        const button = document.createElement('button');
        button.textContent = '显示提示';
        button.style.position = 'absolute';
        button.style.top = '20px';
        button.style.left = '150px'; // 放在打乱按钮旁边
        button.style.padding = '10px 20px';
        button.style.fontSize = '16px';
        button.style.cursor = 'pointer';
        button.style.zIndex = '1000';
        document.body.appendChild(button);
        
        button.addEventListener('click', () => {
            if (!this.isRotating && !this.isScrambling) {
                this.showHint();
            }
        });
    }

    // 显示提示
    showHint() {
        if (this.hintSystem.isActive) {
            this.hideHint();
            return;
        }

        // 创建提示容器
        const hintContainer = document.createElement('div');
        hintContainer.id = 'hintContainer';
        hintContainer.style.position = 'absolute';
        hintContainer.style.top = '80px';
        hintContainer.style.left = '20px';
        hintContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        hintContainer.style.padding = '15px';
        hintContainer.style.borderRadius = '10px';
        hintContainer.style.color = '#ffffff';
        hintContainer.style.zIndex = '1000';
        hintContainer.style.maxWidth = '300px';

        // 创建提示内容
        const hintContent = document.createElement('div');
        hintContent.id = 'hintContent';
        hintContent.style.marginBottom = '10px';

        // 创建控制按钮
        const nextButton = document.createElement('button');
        nextButton.textContent = '下一步';
        nextButton.style.marginRight = '10px';
        nextButton.style.padding = '5px 10px';
        nextButton.style.cursor = 'pointer';

        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.padding = '5px 10px';
        closeButton.style.cursor = 'pointer';

        // 添加事件监听
        nextButton.addEventListener('click', () => this.nextHint());
        closeButton.addEventListener('click', () => this.hideHint());

        // 组装UI
        hintContainer.appendChild(hintContent);
        hintContainer.appendChild(nextButton);
        hintContainer.appendChild(closeButton);
        document.body.appendChild(hintContainer);

        // 生成提示步骤
        this.generateHintSteps();
        this.updateHintDisplay();

        this.hintSystem.isActive = true;
    }

    // 隐藏提示
    hideHint() {
        const container = document.getElementById('hintContainer');
        if (container) {
            container.remove();
            this.hintSystem.isActive = false;
            this.hintSystem.currentStep = 0;
        }
    }

    // 生成提示步骤
    generateHintSteps() {
        this.hintSystem.steps = [
            {
                text: "首先，让我们完成白色十字。将白色边块移动到顶面，使其与中心块对齐。",
                action: () => this.highlightWhiteCross()
            },
            {
                text: "接下来，完成白色角块。将白色角块移动到正确的位置。",
                action: () => this.highlightWhiteCorners()
            },
            {
                text: "现在，完成中间层。将边块移动到正确的位置。",
                action: () => this.highlightMiddleLayer()
            },
            {
                text: "然后，完成顶层十字。将黄色边块移动到正确的位置。",
                action: () => this.highlightYellowCross()
            },
            {
                text: "最后，完成顶层角块。将黄色角块移动到正确的位置。",
                action: () => this.highlightYellowCorners()
            }
        ];
    }

    // 更新提示显示
    updateHintDisplay() {
        const hintContent = document.getElementById('hintContent');
        if (hintContent && this.hintSystem.steps[this.hintSystem.currentStep]) {
            hintContent.textContent = this.hintSystem.steps[this.hintSystem.currentStep].text;
            this.hintSystem.steps[this.hintSystem.currentStep].action();
        }
    }

    // 下一步提示
    nextHint() {
        if (this.hintSystem.currentStep < this.hintSystem.steps.length - 1) {
            this.hintSystem.currentStep++;
            this.updateHintDisplay();
        } else {
            this.hideHint();
        }
    }

    // 高亮白色十字
    highlightWhiteCross() {
        this.clearHighlights();
        this.cubePieces.forEach(piece => {
            const pos = piece.position;
            if (Math.abs(pos.y - 1) < 0.1 && piece.material.diffuseColor.r === 1 && piece.material.diffuseColor.g === 1) {
                this.highlightPiece(piece);
            }
        });
    }

    // 高亮白色角块
    highlightWhiteCorners() {
        this.clearHighlights();
        this.cubePieces.forEach(piece => {
            const pos = piece.position;
            if (Math.abs(pos.y - 1) < 0.1 && Math.abs(Math.abs(pos.x) - 1) < 0.1 && Math.abs(Math.abs(pos.z) - 1) < 0.1) {
                this.highlightPiece(piece);
            }
        });
    }

    // 高亮中间层
    highlightMiddleLayer() {
        this.clearHighlights();
        this.cubePieces.forEach(piece => {
            const pos = piece.position;
            if (Math.abs(pos.y) < 0.1) {
                this.highlightPiece(piece);
            }
        });
    }

    // 高亮黄色十字
    highlightYellowCross() {
        this.clearHighlights();
        this.cubePieces.forEach(piece => {
            const pos = piece.position;
            if (Math.abs(pos.y + 1) < 0.1 && piece.material.diffuseColor.r === 1 && piece.material.diffuseColor.g === 1) {
                this.highlightPiece(piece);
            }
        });
    }

    // 高亮黄色角块
    highlightYellowCorners() {
        this.clearHighlights();
        this.cubePieces.forEach(piece => {
            const pos = piece.position;
            if (Math.abs(pos.y + 1) < 0.1 && Math.abs(Math.abs(pos.x) - 1) < 0.1 && Math.abs(Math.abs(pos.z) - 1) < 0.1) {
                this.highlightPiece(piece);
            }
        });
    }

    // 高亮单个块
    highlightPiece(piece) {
        const highlightMaterial = new BABYLON.StandardMaterial("highlight", this.scene);
        highlightMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        piece.material = highlightMaterial;
    }

    // 清除所有高亮
    clearHighlights() {
        this.cubePieces.forEach(piece => {
            this.applyOriginalMaterials(piece);
        });
    }
}

// 当页面加载完成后初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    const game = new RubiksCubeGame();
}); 