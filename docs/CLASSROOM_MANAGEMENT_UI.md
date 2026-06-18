# 课堂管理页面使用说明

## 功能概述

课堂管理页面提供了完整的课节管理功能，包括：

1. **课节列表展示** - 分页显示所有课节信息
2. **课节编辑** - 通过对话框编辑课节详细信息
3. **课节删除** - 带确认对话框的删除功能

## 页面组件

### 主要文件

- `app/dashboard/classroom/page.tsx` - 主页面组件
- `components/classroom/EditClassroomDialog.tsx` - 编辑对话框组件
- `lib/services/classrooms.ts` - 课节服务层

### 功能特性

#### 1. 课节列表
- 显示课节ID、名称、班级、时间等信息
- 支持分页浏览
- 实时刷新功能

#### 2. 编辑功能
- 点击编辑按钮打开编辑对话框
- 支持修改以下字段：
  - 课节名称（必填）
  - 开始时间
  - 结束时间
  - 教师UID
  - 教师姓名
  - 录制开关
  - 直播开关
  - 回放开关

#### 3. 删除功能
- 点击删除按钮显示确认对话框
- 防止误删除操作
- 删除后自动刷新列表

## 环境配置

在 `.env.local` 文件中配置以下环境变量：

```env
# ClassIn API v2 认证信息（仅服务端读取）
CLASSIN_SID="your-classin-sid"
CLASSIN_SECRET="your-classin-secret"
CLASSIN_API_URL="api.eeo.cn"
```

## API 集成

页面通过以下API与后端交互：

1. **获取课节列表**: `GET /api/classroom-classin`
2. **修改课节**: `PUT /api/classin/classrooms`
3. **删除课节**: `DELETE /api/classin/classrooms`

`GET /api/classroom-classin` 会按当前用户可访问课程/课节过滤镜像数据；修改和删除 ClassIn 远端课堂仅限 admin / academic_affairs。

## 使用流程

### 1. 查看课节列表
1. 访问 `/dashboard/classroom` 页面
2. 页面自动加载课节列表
3. 使用分控件浏览更多数据

### 2. 编辑课节
1. 在课节列表中点击编辑按钮（铅笔图标）
2. 在弹出的对话框中修改信息
3. 点击"保存"按钮提交修改
4. 等待成功提示，列表自动刷新

### 3. 删除课节
1. 在课节列表中点击删除按钮（垃圾桶图标）
2. 在确认对话框中点击"确认删除"
3. 等待删除完成，列表自动刷新

## 安全注意事项

1. **认证信息**: ClassIn SID 和 SECRET 只能放在服务端环境变量，不要使用 `NEXT_PUBLIC_*`
2. **权限控制**: 修改或删除远端 ClassIn 课堂仅限 admin / academic_affairs
3. **操作确认**: 删除操作需要二次确认
4. **错误处理**: 所有操作都有完善的错误提示

## 技术实现

### 状态管理
- `classrooms`: 课节列表数据
- `isLoading`: 加载状态
- `isEditing`: 编辑操作状态
- `isDeleting`: 删除操作状态
- `editingClassroom`: 当前编辑的课节对象
- `isEditDialogOpen`: 编辑对话框开关状态

### 关键函数
- `fetchClassrooms()`: 获取课节列表
- `handleEditClassroom()`: 处理编辑操作
- `handleDeleteClassroom()`: 处理删除操作
- ClassIn 认证由后端 SDK 根据服务端环境变量生成签名

### UI组件使用
- `shadcn/ui` 组件库
- `lucide-react` 图标库
- `AlertDialog` 删除确认对话框
- `Dialog` 编辑对话框

## 扩展建议

1. **搜索功能**: 添加课节名称搜索
2. **筛选功能**: 按时间、状态等筛选
3. **批量操作**: 支持批量删除或修改
4. **导出功能**: 导出课节列表到Excel
5. **操作日志**: 记录所有操作历史

## 故障排除

### 常见问题

1. **无法加载列表**: 检查API端点和网络连接
2. **编辑失败**: 检查服务端 ClassIn 环境变量和当前用户权限是否正确
3. **删除失败**: 确认课节是否存在且可删除
4. **权限错误**: 检查用户是否有相应权限

### 调试方法

1. 打开浏览器开发者工具查看网络请求
2. 检查控制台错误信息
3. 验证服务端环境变量配置
4. 查看后端API日志
