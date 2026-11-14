# 可拆式板式换热器

本模型采用前端四接管、单流程逆流布置。HTML 和 GLB 共用同一套装配参数。HTML 内置几何、脚本和字体，可以直接在支持 WebGL 2 的浏览器中离线打开。

## 打开模型

下载 [index.html](./index.html)，用浏览器打开即可旋转整机、逐层拆解或观察红蓝流道，无需安装软件。GitHub 的文件页显示源码，点击文件页右上角的 **Download raw file** 可保存交互页面。

| 文件 | 用途 |
| --- | --- |
| [plate-heat-exchanger.glb](./plate-heat-exchanger.glb) | 导入 Blender 等三维软件，编辑装配与拆解动画 |
| [flow-paths.json](./flow-paths.json) | 100 个流道的 500 条示意流线，按部件 ID 绑定 |
| [plate-heat-exchanger-kit.zip](./plate-heat-exchanger-kit.zip) | 一次下载模型、流线、使用说明及可编辑源码 |
| [source/](./source/) | 参数化几何、装配逻辑与交互界面源码 |

## 交互演示

- **整机装配**默认停在压紧位置。板包由 101 张板片组成，在两块压紧板之间长 252.5 mm。活动压紧板外侧平面离后立柱内面 80 mm。侧面可看到密集的银色板边与六组拉紧螺栓。
- **轴向拆解**的前半程演示退出紧固件、活动端沿导杆退开 60 mm。后半程为爆炸图，后支架整体移开，101 张板片逐层展示。中部四道间距加宽，便于辨认垫片。底座、导杆及压紧件保持各自的刚体尺寸。
- **板片与密封**将一对相邻板片及其中间垫片拉开。可选择 P01–P02 至 P100–P101 的任意一对。
- **相邻逆流**同时显示三片板和其中的两条流道。红色热侧由 S4 上进、S3 下出。蓝色冷侧由 S2 下进、S1 上出。将拆解进度拖到 0 可回到压紧位置，并观察与四根总管的连接。
- **波纹接触截面**取自 P49–P51 中心的 88 × 60 mm 区域，将板厚方向放大 8 倍。两侧流体实体与三张板的曲面共用采样点。
- 在「零件树」中点击眼睛可隐藏单件或整组。选择零件后点击「仅显示选中件」即可隔离。再次点击可退出隔离。双击模型中的零件也可隔离。切换观察视图会装载该视图的默认显示组合。
- 鼠标拖动旋转，右键拖动平移，滚轮缩放。触屏支持单指旋转、双指缩放与平移。手机右上角的「控制台」可展开设置。数字 1–5 切换视图，空格暂停流向标记。「闲置导览」控制空闲 25 秒后是否继续自动播放。

## GLB 装配与动画

通过 Blender 的 glTF 2.0 导入功能打开 GLB。文件采用米作为场景单位，根节点 PHE101 带有 0.001 的比例变换，子零件的局部坐标以 mm 编写。+Y 为竖直向上，+Z 从板包指向接管。导入器会按宿主坐标系进行转换。

| 节点组 | 数量 | 内容 |
| --- | ---: | --- |
| Group_fixed、Group_moving | 1 + 1 | 固定压紧板与活动压紧板 |
| Group_plates | 101 | 独立板片，P01–P100 四孔，P101 为盲端 |
| Group_seals | 101 | 100 套板间垫片，以及固定端首片的四孔端口垫 |
| Group_guides | 2 | 上承重导杆、下定位导杆 |
| Group_ties | 24 | 6 支压紧螺栓、6 个螺母、12 个垫圈 |
| Group_stand | 3 | 立柱、前底座、后底座 |
| Group_pipes | 4 | S1–S4 独立接管 |
| Group_fluid | 104 | 100 个板间流体实体和 4 个角孔总管流体实体 |

上述 341 个部件节点均有英文稳定 ID，中文名称位于 glTF extras 的 label 字段。Flow_markers 下另有 100 个流向示踪符号。可单独关闭 Group_fluid 和 Flow_markers，查看纯机械装配。

| GLB 动画片段 | 时长 | 用法 |
| --- | ---: | --- |
| 01_Explode_and_reassemble | 12 s | 0 秒压紧，6 秒完全展开，12 秒复位。总管流体在拆解时缩回接管以便观察。 |
| 02_Counterflow_in_assembled_pack | 8 s | 在压紧位置播放 100 个示踪符号。隐藏机架并调低板片及流体域材质的不透明度，可看到各层运动。 |

流向路径 JSON 含 100 条流道各 5 根轨迹，共 500 根。每根由 241 个三维点组成，按入口至出口排列，每个点为 [x, y, z]。坐标以所属 Channel 节点为原点，单位 mm，已包含板间中面随人字纹起伏产生的轴向位移。使用路径时，将曲线作为对应 Channel 节点的子对象即可随零件移动。这些轨迹用于可视化流向，速度与温度场需由相应的流动模型另行给定。

## 几何约定

- 固定端外形参考 320 × 920 mm，四孔横向与纵向中心距分别为 140、640 mm。材料着色区分涂装框架、不锈钢、弹性体及两种流体。
- 机架和压紧尺寸为本演示选配。前后端板厚 32 mm 和 30 mm，上下导杆从固定板内面延伸到后立柱内面，有效跨距 362.5 mm。
- 示意板厚为 0.5 mm，压紧后的相邻板中面节距为 2.5 mm，名义通道净隙为 2.0 mm。示意波纹纵向节距为 24 mm，单侧振幅为 1.0 mm。在中心换热区，交叉波峰处接触，局部净隙在 0 至 4 mm 之间变化。
- 奇偶板取相反的人字纹方向。板间垫片以场垫包住本侧两个角孔，并以两个闭合孔环隔开另一侧通孔。末片封住四根总管，活动端保持干面。
- 爆炸视图移动各实体，流道保留压紧状态下的形状。「板片与密封」和「相邻逆流」为观察选定几层额外拉开间距。波纹纵向节距、吊槽、接管、紧固件及垫片截面采用展示尺寸。

外形与名义流道间隙取自 Alfa Laval 的 M6 系列，板片转向及厚度另参考其备件资料。四口的冷热分配采用这里选定的演示工况。[M6 技术资料](https://www.alfalaval.com/globalassets/documents/microsites/heating-and-cooling-hub/pd-leaflets---gasketed/m6.pdf) · [A/B 板片](https://shop.alfalaval.com/en-us/gasketed-plates--1386555/channel-plate--1627033-) · [单流程逆流演示](https://www.youtube.com/watch?v=uEInVVcc6Sc)

## 从源文件重建

从仓库根目录执行以下命令。需要 Node.js 22 或更高版本和 npm。[teardown](https://github.com/elvarofficial/teardown) 提供渲染与打包工具。如果本机已有这套工具及依赖，可以将环境变量 `TEARDOWN_SKILL` 指向它，并跳过前 3 行。

```sh
git clone https://github.com/elvarofficial/teardown.git .deps/teardown
git -C .deps/teardown checkout a91262ac1109051e014662d42ecb0b7bc1f113b1
npm --prefix .deps/teardown install
node source/build.mjs
node source/export.mjs
```

生成的 HTML、GLB 和流向 JSON 位于 `dist/`；可通过 `PHE_OUT` 更改。

src/design.js 定义四孔、波形、板间净隙、路径与拆解轨迹。src/mesh.js 生成双面带厚度的板片和封闭流体实体。src/model.js 装配零件，src/timeline.json 定义可选交互导览的切换时间。GLB 文件采用共享几何复用相同板型和紧固件，每个实例有独立变换。
