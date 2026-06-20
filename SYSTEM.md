# Digita System Notes

## Project Goal

本项目目前作为 DigitalPlat Domains 相关网站开发工作区。后续网站功能应依据 `.codex/API.md` 中整理的 DigitalPlat Domains API 进行设计与实现。

## Current Status

- 已建立 Vue 3 + Vite + Element Plus 前端应用。
- 已新增 API 参考文件，作为后续开发域名管理网站、前端页面或后端代理服务的依据。
- API Key 由前端页面填写并保存到浏览器 `localStorage`，开发环境通过 Vite 本地代理 `/api/digitalplat/*` 调用上游 API。
- 域名总览支持列表、搜索、固定高度内部滚动、分页、更新名称服务器和删除确认。
- 注册域名已拆分为独立页面。

## Directory Structure

```text
.
├── .codex/
│   └── API.md
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── api/
│   │   ├── cloudflare.js
│   │   └── digitalplat.js
│   ├── composables/
│   │   └── useDomainConsole.js
│   ├── config/
│   │   └── domainSuffixes.js
│   ├── pages/
│   │   ├── CloudflarePage.vue
│   │   ├── DomainsPage.vue
│   │   └── RegisterDomainPage.vue
│   └── styles/
│       ├── cloudflare.css
│       ├── main.css
│       ├── register.css
│       └── table.css
└── SYSTEM.md
```

## API Source Of Truth

`.codex/API.md` 是目前项目内的 API 说明来源，内容包含：

- Base URL: `https://domain-api.digitalplat.org/api/v1`
- Bearer API Key 验证方式
- API Key 前缀：`dp_live_`、`dp_test_`
- 统一响应格式：`success`、`data`、`meta`
- 域名列表、注册、更新 nameservers、删除域名等端点
- 前端开发注意事项与安全限制

## Planned Functional Modules

后续若继续开发网站，建议按以下模块拆分：

- API client: 封装 DigitalPlat Domains API 请求、错误处理与 response envelope parsing。
- Domain management: 域名列表、状态显示、注册流程、nameserver 更新、删除确认。
- Auth/config layer: 管理 API Key 输入、服务端代理配置或安全凭证注入方式。
- UI components: 表格、表单、确认对话框、状态标签、错误提示。
- Tests: API client 单元测试、表单验证测试、删除确认流程测试。

## Security Decisions

- 真实 API Key 不得硬编码到源码。
- 若网站会在浏览器中公开执行，必须通过后端代理或其他服务端安全环境调用 DigitalPlat Domains API。
- 目前 Vite dev server 已提供 `/api/digitalplat/*` 本地代理，从请求头 `X-DigitalPlat-Api-Key` 读取 API Key 并注入上游请求。
- DigitalPlat 上游会对部分非浏览器请求触发安全检查；本地代理会转发浏览器 `User-Agent`、`Accept-Language`，并设置 `Accept: application/json`。
- 实测上游列表数据字段包含 `domain`、`expires_at`；前端 API client 会规范化为页面使用的 `name`、`expiry_date`。
- `.env.local` 不再是 API Key 配置入口；如后续只配置 API Base URL，仍不应提交到版本库。
- 删除域名会进入 `pendingdelete` 且 DNS 立即停用，因此 UI 必须加入二次确认。
- 对外请求与敏感配置应集中在 API client 或服务端代理模块，不应散落在 UI 组件内。
- Cloudflare 多账号信息当前保存到浏览器 `localStorage`，仅用于本地开发页面；生产环境应迁移到后端安全存储。

## Change Log

### 2026-06-01

- 新增 `.codex/API.md`。
- 将先前对话中读取到的 DigitalPlat Domains API 文档提炼为项目内固定说明。
- 新增本文件 `SYSTEM.md`，记录项目目标、目前状态、目录结构、API 来源、后续模块建议与安全决策。
- 本次变更没有新增可执行程序代码，不影响既有功能。

### 2026-06-01 18:50

- 建立 Vue 3 + Vite + Element Plus 前端页面。
- API Key 放在 `.env.local`，不进入 git。
- 新增 `vite.config.js` 中的 `/api/digitalplat/*` 本地代理，避免把真实 API Key 打包进浏览器 bundle。
- 新增 `src/api/digitalplat.js`，统一封装域名列表、注册、更新 nameservers、删除域名与 API 配置状态检查。
- 新增 `src/App.vue`，提供域名列表、域名注册、更新 nameservers、删除确认等 Element Plus 管理页面。
- 新增 `src/styles/main.css`，提供页面基础版面与响应式样式。

### 2026-06-01 19:55

- 修复域名列表无法载入问题。
- 确认 API Key 已配置且可直接取得 8 笔域名数据。
- 问题原因不是 API Key 无效，而是 Vite 代理原先使用 Node `fetch` 调用上游时被 DigitalPlat Cloudflare 安全检查回传 403 challenge page。
- 将 Vite 本地代理改为使用 PowerShell/.NET `Invoke-WebRequest` 转发请求；API Key 通过环境变量传入子程序，不出现在命令行参数。
- 修正 API client 对上游字段的规范化：上游回传 `domain`、`expires_at`，前端统一映射为 `name`、`expiry_date`。

### 2026-06-01 20:00

- 重做域名管理页面视觉结构，改为更标准的 Element Plus 后台界面。
- 新增左侧导航、顶部面包屑与操作区、统计卡片、表格工具栏、状态标签与 nameserver tag 显示。
- 保留原有 API client、注册、刷新、更新 nameservers、删除确认等功能行为。
- 精简自定义 CSS，使样式主要依赖 Element Plus 组件体系。

### 2026-06-01 20:10

- 重新设计整体视觉，从简单后台表格升级为更完整的控制台风格。
- 将注册流程拆成独立页面 `src/pages/RegisterDomainPage.vue`，域名总览保留在 `src/pages/DomainsPage.vue`。
- 新增 `src/composables/useDomainConsole.js`，集中处理 API 状态、列表载入、注册、更新 nameservers、删除等状态逻辑。
- `src/App.vue` 改为应用壳层与页面切换，避免把页面、API 状态与表单流程混在单一大文件中。
- 视觉更新为暗色侧边栏、玻璃质感工作区、独立 hero panel、统计卡片、精致工具栏与单独注册工作流。
- 保持所有源码文件低于 300 行，符合本项目代码规范。

### 2026-06-01 20:18

- 收敛控制台视觉比例，避免 hero、统计卡与侧栏过大。
- 将域名总览的 hero panel 改为紧凑 command strip，缩小侧栏、顶栏、统计卡与表格行高。
- 强化 Element Plus 表格、按钮、tag、输入框的细节质感，使界面更像高密度管理工具。
- 注册页保留独立页面，但缩小标题、表单与辅助说明区尺度。

### 2026-06-01 20:22

- 进一步压缩域名总览上半区高度。
- 顶栏高度从 72px 降至 56px，主内容边距、command strip、统计卡片与标题字号同步缩小。
- 目标是让表格更早进入首屏，符合管理工具高密度扫描需求。

### 2026-06-01 20:26

- 精修域名列表表格样式。
- 新增域名视觉标识、表格 hover 左侧 accent 线、monospace nameserver tag、状态/slot pill 与更紧凑的操作按钮。
- 将表格相关样式拆分到 `src/styles/table.css`，保持 `main.css` 低于 300 行。

### 2026-06-01 20:32

- 将常驻侧边栏改为顶部菜单按钮 + 左侧 Drawer 弹窗导航。
- 主工作区改为全宽展示，释放表格横向空间，降低横向滚动概率。
- 移除域名列表操作列 fixed 设置，让表格在全宽版面中自然排布。

### 2026-06-01 20:36

- 移除域名总览中的四个统计卡片，让列表区更靠前。
- 将 Drawer 导航改为浅色高对比样式，改善导航文字可读性。

### 2026-06-01 20:40

- 域名表格新增固定高度与内部滚动，避免数据过多时撑高整页。
- 新增 Element Plus 分页组件，支持 10、20、50、100 笔 page size。
- 搜索关键字或切换 page size 时会自动回到第 1 页。

### 2026-06-01 20:45

- UI 文案统一改为简体中文。
- Element Plus 全局语言包改为 `zh-cn`，分页组件显示中文文案。
- Nameservers 字段由多 tag 展开改为首个 nameserver + `+N` 摘要，tooltip 显示完整列表，降低字段宽度占用。

### 2026-06-01 20:55

- 进一步压缩域名表格列宽：域名列、状态列、容量类型、生命周期、到期日与名称服务器列都改为更紧凑的固定宽度。
- Nameservers 可见列改名为“名称服务器”，只显示首个值和 `+N` 数量，完整内容继续通过 tooltip 查看。
- 更新名称服务器弹窗、注册页、列表页文案全部改为简体中文，减少中英文混用。
- `.codex/API.md` 与 `SYSTEM.md` 也同步整理为简体中文，后续开发默认按简体 UI 文案继续。

### 2026-06-01 21:05

- 修正 Element Plus 表格默认 `fit` 行为导致域名列吃掉剩余宽度的问题。
- 域名表格改为固定列宽，并新增一个空白伸缩列承接剩余空间，让业务列宽按设计值显示。
- 操作列压缩到 112px，域名列固定 280px，名称服务器列保持摘要显示。

### 2026-06-01 21:12

- 表格列宽从固定像素方案改为百分比方案，避免大屏右侧出现明显空白。
- `DomainsPage.vue` 移除固定 `width` 和空白伸缩列，恢复表格铺满容器。
- `table.css` 通过 `.domain-table col:nth-child(...)` 设置列宽比例：域名 22%、状态 9%、容量类型 10%、生命周期 12%、到期日 11%、名称服务器 24%、操作 12%。

### 2026-06-01 21:18

- 名称服务器列改为最多两行纵向展示，优先显示前两个 nameserver。
- 超过两个 nameserver 时继续显示 `+N` 摘要，完整列表保留在 tooltip 中。
- 操作列表头和按钮区域改为居中对齐。

### 2026-06-01 21:28

- 域名表格新增多选列，支持批量选择当前分页内的域名。
- 勾选域名后显示批量操作条，提供“批量删除”。
- 批量删除增加二次确认，确认后并发调用删除接口并刷新列表。
- 表格百分比列宽重新分配，新增选择列后仍保持页面铺满和操作列居中。

### 2026-06-01 21:32

- 移除批量更新 NS 功能入口与实现逻辑。
- 原因：nameserver 配置与域名逐个对应，批量写入同一组 NS 容易造成误操作。
- 批量操作目前仅保留批量删除，单个域名仍可通过行内 NS 按钮更新名称服务器。

### 2026-06-01 21:42

- 注册页域名输入从“完整域名”改为“域名前缀 + 免费后缀下拉”。
- 默认后缀为 `.dpdns.org`，提交时自动拼接完整域名，用户无需手动输入后缀。
- 新增 `src/config/domainSuffixes.js` 管理免费后缀选项，目前包含 `.dpdns.org`、`.qzz.io`、`.us.kg`、`.xx.kg`。
- `.codex/API.md` 同步补充官网公开展示的免费后缀清单。

### 2026-06-01 21:50

- 美化注册域名页面，表单主体增加轻量分组容器，减少大面积空白。
- 完整域名预览改为蓝色提示胶囊，更突出自动拼接结果。
- 右侧“提交前检查”从 Element Plus timeline 改为更紧凑的 checklist，视觉上更贴近管理台表单。
- 名称服务器输入高度从 5 行收为 4 行，整体表单更紧凑。

### 2026-06-01 21:58

- 注册页增加最大宽度限制，避免表单卡片在宽屏下横向撑满造成大面积空白。
- 注册表单列从 640px 收为 600px，检查区收为 300px，并缩小两栏间距和卡片内边距。
- 名称服务器输入高度从 4 行继续收为 3 行，减少卡片下方空白。

### 2026-06-01 22:08

- 注册页新增“单个注册 / 批量注册”模式切换。
- 批量注册模式只需输入数量，系统自动生成前缀，并避开当前已加载域名列表中的重复域名。
- 批量注册逐个调用注册接口，避免并发过猛；完成后刷新域名列表。
- 新增 `src/styles/register.css` 拆分注册页样式，`main.css` 回归全局布局样式。
- 批量数量当前限制为 1 到 50，后缀和名称服务器仍由表单统一配置。

### 2026-06-01 22:16

- 批量注册前缀规则改为 5-8 位数字与小写字母组合，不再使用较长的 `dg + 时间片` 前缀。
- 批量注册逻辑从页面候选生成改为 composable 内部补足式注册：失败后自动换新前缀继续尝试，直到达到目标数量或超过尝试上限。
- 当前尝试上限为 `max(count * 20, 50)`，避免无限循环。
- 注册页批量模式只提交数量、后缀、容量类型与 nameservers，不再预生成固定域名列表。

### 2026-06-01 22:22

- Drawer 导航样式调整：`el-drawer__body` 增加满高约束，菜单区设置为可伸缩区域。
- API 状态卡片固定在导航底部，不再贴在菜单项下方。

### 2026-06-01 22:26

- 进一步修正 Drawer 高度问题：`.nav-drawer` 强制使用 `100vh`，`.el-drawer__body` 使用 `height: 100%`。
- 解决 Drawer 内容高度只由内部内容撑开，导致 API 状态无法真正贴到底部的问题。

### 2026-06-01 22:31

- Drawer 内新增 `.nav-content` 容器，直接使用 `min-height: calc(100vh - 36px)` 承接导航内容。
- API 状态由 `.nav-content` 的 flex 布局推到底部，避免 Element Plus Drawer 内部层级导致 `margin-top: auto` 失效。

### 2026-06-01 22:36

- 修复 Drawer 出现多余滚动条的问题。
- `.nav-content` 从 `min-height: calc(100vh - 36px)` 改为 `height: 100%`，避免和 Drawer body padding 叠加超高。
- Drawer body 增加 `overflow: hidden`，导航内部不再产生无意义滚动。

### 2026-06-01 22:44

- API Key 配置从 `.env.local` 改为前端填写。
- `src/api/digitalplat.js` 新增 `localStorage` 读写逻辑，请求时通过 `X-DigitalPlat-Api-Key` 传给本地代理。
- `vite.config.js` 不再读取 `DIGITALPLAT_API_KEY`，改为从请求头读取 API Key 并转发到上游。
- Drawer 底部 API 状态可点击打开配置弹窗，保存后会自动刷新域名列表。
- `.codex/API.md` 同步记录当前开发版的前端 API Key 存储与代理转发方式。

### 2026-06-01 23:05

- 参考桌面 `opaiRe` 项目的 Cloudflare 域名托管流程，集成轻量 Cloudflare 功能。
- 新增 `src/api/cloudflare.js`：浏览器本地保存多个 CF 账号、默认账号，并封装添加/删除 CF 托管请求。
- 新增 `src/components/CloudflareSettings.vue` 与 `src/styles/cloudflare.css`：提供多个 CF 账号添加、删除、默认账号选择。
- `vite.config.js` 新增 `/api/cloudflare/zones/add` 与 `/api/cloudflare/zones/delete` 本地代理，使用 CF Global API Key 调用 Cloudflare v4 API。
- 注册页新增“托管 CF 并填入 NS”按钮：使用默认 CF 账号添加当前完整域名到 CF，读取 `name_servers` 后自动填入名称服务器 textarea。
- 域名列表行内新增 `CF` 操作按钮，可删除对应域名的 Cloudflare 托管。
- 当前 CF 集成为本地开发版，账号信息保存在浏览器 `localStorage`，未写入源码。

### 2026-06-01 23:18

- 将 Cloudflare 功能从弹窗改为独立页面 `src/pages/CloudflarePage.vue`，与域名总览、注册域名保持同级页面结构。
- Drawer 导航新增 `Cloudflare` 菜单项，移除原先的“Cloudflare 账号”弹窗按钮与 `src/components/CloudflareSettings.vue`。
- Cloudflare 页面包含三块能力：多账号本地管理、批量添加域名到 CF 并获取 NS、批量删除 CF 托管。
- 执行结果使用独立表格展示域名、成功/失败状态、返回的名称服务器和消息，方便批量操作后复核。
- 注册页的一键“托管 CF 并填入 NS”和域名列表行内删除 CF 托管功能继续复用 `src/api/cloudflare.js`。
- Cloudflare 页面不依赖 DigitalPlat API Key，因此不会显示 DigitalPlat API Key 未配置提示。
- `src/styles/cloudflare.css` 从弹窗样式扩展为页面级布局样式，保持后台工具风格和紧凑密度。

### 2026-06-02 00:08

- 将 Cloudflare 页面用户可见文案中的 `Zone` 改为更直观的 `CF 托管` / `添加到 CF`。
- 内部 API 函数仍保留 `addCfZone`、`deleteCfZone` 命名，因为 Cloudflare 官方接口资源名是 Zone，便于后续按官方文档维护。

### 2026-06-02 00:16

- 修复 Cloudflare 页面在中等宽度窗口下横向漂移的问题。
- `src/styles/cloudflare.css` 移除页面居中 `max-width`，改为跟随主工作区全宽展示。
- CF 页面主区域改为 flex 布局：账号管理面板自适应剩余空间，右侧 CF 托管操作栏使用 `clamp(300px, 26vw, 360px)` 固定合理宽度。
- 账号管理面板增加 `overflow: hidden` 与 `min-width: 0`，避免 Element Plus 表格把整行撑到异常宽度。
- CF 页面外层覆盖全局 `.page-stack` 的 grid 行为，改为独立 flex column，避免表格最小内容宽度反向撑大整页。
- 右侧按钮改为纵向满宽排列并允许换行，避免长中文按钮文案导致横向溢出。

### 2026-06-02 00:25

- 简化 Cloudflare 账号添加表单，移除“账号名称”输入项。
- 新增 CF 账号时直接使用 CF 邮箱作为列表中的名称，减少重复填写。

### 2026-06-02 00:32

- 修复 Cloudflare 页面“执行结果”表格空数据时出现内部横向滚动条的问题。
- 结果表列宽改为百分比 / 自适应组合，并隐藏 Element Plus 表格横向 scrollbar。

### 2026-06-02 00:38

- 修复 Cloudflare 页面“执行结果”表头被挤成竖排的问题。
- 结果表恢复固定像素列宽，避免 Element Plus 将百分比列宽解析成异常窄列。
- 为结果表头与单元格添加 `white-space: nowrap`，空态仍允许正常换行。

### 2026-06-02 00:50

- 将 CF 域名操作从 Cloudflare 页面迁移到“域名总览”的批量选择流程。
- 域名列表勾选域名后新增两个批量按钮：`添加到 CF 并写入 NS`、`删除 CF 托管`。
- 新增 `src/composables/useCloudflareBatch.js`，集中处理批量添加 CF、读取返回 NS、逐个写回 DigitalPlat、批量删除 CF 托管与 loading 状态。
- Cloudflare 页面改为只负责多个 CF 账号管理，不再要求手动输入域名列表。
- `src/composables/useDomainConsole.js` 新增 `updateNameserversByName(domain, nameservers)`，用于批量流程按域名写回 NS。

### 2026-06-02 00:58

- 批量添加到 CF 时会先检查域名当前 nameservers，若已包含 `ns.cloudflare.com` 则跳过，不再重复写入。
- 域名总览新增 `CF 状态` 列，基于 nameservers 显示 `已接入` / `未接入`。
- 批量添加结果提示新增“跳过”数量，便于区分已接入域名和本次新写入域名。

### 2026-06-02 01:05

- CF 状态列增加账号简称显示：通过本工具接入的域名会记录“域名 -> CF 账号”本地映射，并在列表中显示对应 CF 账号邮箱前缀。
- 通过外部方式已经接入 CF、但本地没有账号映射的域名继续显示 `已接入`。
- 批量添加 CF 成功后写入账号映射，删除 CF 托管后清理账号映射。

### 2026-06-02 01:14

- 新增 `同步 CF 状态` 操作：使用已配置的多个 CF 账号逐个反查已接入 CF 的域名，找到所属账号后写入本地映射。
- `vite.config.js` 新增 `/api/cloudflare/zones/lookup` 本地代理端点，用于按账号查询 CF Zone 是否存在。
- `src/api/cloudflare.js` 新增 `lookupCfZone(domain, account)`，供状态同步流程调用。
- 同步逻辑只查询 nameservers 已包含 `ns.cloudflare.com` 且本地尚无账号映射的域名，减少无意义请求。

### 2026-06-02 01:22

- 域名总览新增 CF 筛选下拉：支持全部、未接入、已接入、已识别账号，以及按具体 CF 账号简称筛选。
- CF 筛选与域名搜索关键字组合生效，切换筛选条件时自动回到第一页。

### 2026-06-02 01:28

- 域名总览新增状态筛选下拉，状态选项会根据当前域名列表中的 `status` 动态生成。
- 状态筛选与搜索、CF 筛选组合生效，切换状态筛选时自动回到第一页。

### 2026-06-02 19:36

- 新增登录页 `src/pages/LoginPage.vue` 与 `src/styles/login.css`。
- 应用启动时若浏览器本地没有 DigitalPlat API Key，则先显示登录页；填写 `dp_live_` 或 `dp_test_` 开头的 API Key 后保存到 localStorage 并进入控制台。
- 已保存 API Key 时刷新会直接进入控制台，原控制台内“未配置 API Key”提示移除。
- Drawer 底部 API 状态配置仍保留，用于登录后更换或清除 API Key。

### 2026-06-02 19:12

- 新增开发服务停止操作。
- `package.json` 新增 `npm run stop`，调用 `scripts/stop-dev.ps1` 停止占用 5173 端口的本地开发服务进程。
- `.codex/environments/environment.toml` 新增 `停止` action，菜单中可直接执行停止操作。

### 2026-06-02 19:18

- 修正 Codex 桌面端执行“停止”action 时可能触发 `AttachConsole failed` 的问题。
- 新增 `scripts/stop-dev.cmd`，使用 `netstat` + `taskkill` 直接停止监听 5173 端口的进程。
- `.codex/environments/environment.toml` 的“停止”action 改为直接执行 `scripts\\stop-dev.cmd`，并暂用通用 `run` 图标，避免不兼容的 action 图标或多层 PowerShell 调用触发桌面端异常。

### 2026-06-02 19:24

- 修正 Codex 桌面端执行“启动”action 时可能触发 `AttachConsole failed` 的问题。
- 新增 `scripts/start-dev.cmd`，优先直接调用 `node_modules\\.bin\\vite.cmd --host 0.0.0.0 --port 5173`，避免 action 直接执行 `npm run dev`。
- `.codex/environments/environment.toml` 的“启动”action 改为直接执行 `scripts\\start-dev.cmd`。

### 2026-06-07

- 域名总览工具栏新增“粘贴删除”入口，支持直接粘贴逗号、空格或换行分隔的域名列表后批量删除。
- `src/App.vue` 新增批量粘贴删除对话框与解析逻辑，会自动去重并复用既有 `deleteDomainsByNames` 删除流程。
- `src/pages/DomainsPage.vue` 新增 `paste-delete` 事件入口；`src/styles/main.css` 新增对话框提示文案样式。
- 本次修改不影响原有表格勾选批量删除，只是额外提供适合复制整串域名的删除方式。
- 已选域名的批量操作条新增“复制域名”按钮，可将所选域名按 `a.com,b.com,c.com` 格式直接写入系统剪贴板，便于回填到“粘贴删除”或其他流程。
- 修复部分运行环境中 `navigator.clipboard` 不存在导致复制失败的问题，新增 `src/utils/clipboard.js`，优先使用 Clipboard API，缺失时自动回退到隐藏 textarea 复制。
- 新增 `src/utils/domainList.js`，集中处理域名列表解析与勾选域名格式化，避免批量删除和复制逻辑继续堆在 `App.vue`。
- 新增 `src/composables/useDomainDeleteActions.js`，集中处理单个删除、表格勾选批量删除与粘贴批量删除的确认流程，让 `App.vue` 继续保持应用壳层职责。
- 粘贴批量删除新增“同时删除 Cloudflare 托管”勾选项；勾选后会先逐个删除 CF 托管并清理本地账号映射，再删除 DigitalPlat 域名。
- 新增 `src/composables/usePasteDeleteFlow.js`，集中管理粘贴删除对话框状态、域名解析、CF 删除与 DigitalPlat 删除串接流程。
- 修复 Cloudflare 托管删除只使用默认 CF 账号的问题：新增 `deleteCfZoneSmart`，会优先使用本地域名账号映射，再尝试默认账号与所有已配置账号。
- 单个删除 CF、表格批量删除 CF、粘贴批量删除 CF 都统一改用多账号删除流程，并在失败提示中显示每个域名的具体失败原因，便于区分账号不匹配、权限错误或域名已不存在。
- 修复部分浏览器环境不支持 `crypto.randomUUID()` 导致 Cloudflare 页面点击“添加账号”无反应的问题。
- Cloudflare 账号添加现在使用兼容 ID 生成方式，并在添加成功后立即保存到 `localStorage`，不再要求用户额外点击“保存账号”才持久化。
- Cloudflare 账号删除也改为立即同步保存，避免删除后未点击“保存账号”导致刷新又恢复旧账号。

### 2026-06-08

- 域名总览表格的“到期日”列新增排序箭头，使用 Element Plus `sortable="custom"`。
- 排序作用于搜索、CF 筛选、状态筛选后的完整结果集，再执行分页，避免只排序当前页。
- 切换排序方向时自动回到第 1 页，支持上游返回的 `YYYYMMDD` 与 `YYYY-MM-DD` 日期格式，日期无法解析的记录会排到最后。

### 2026-06-20

- Git 上传前整理忽略规则：`.gitignore` 新增 `.codex/environments/` 与 `.playwright-cli/`，避免提交本机 Codex action 设置与 Playwright CLI 执行记录。
- 保留 `.codex/API.md` 作为项目 API 参考文件，不影响既有架构或应用行为。

## Open Items

- 尚未建立测试目录与测试用例。
- 尚未接入生产后端代理，当前仍使用 Vite 开发代理保护 API Key。

