# Productivity Report Hours Calculation Debug Guide

## 问题描述
Mark Lane 在 2024 年 7-9 月的计费小时数在生产力报告中显示过高，无法与 Supabase timesheet_uploads 表的数据对账。

## 计算逻辑说明

### API 路由
- **文件**: `src/app/api/productivity/monthly/route.ts`
- **端点**: `/api/productivity/monthly`

### 数据查询条件
1. `organization_id` = 当前组织 ID
2. `billable` = true
3. 如果选择了 Staff，则 `staff` = 选定的员工姓名（精确匹配）
4. 日期范围：
   - Current Year: 当前财年 7 月 1 日 到 选定的 as-of 日期
   - Last Year: 上一财年 7 月 1 日 到 6 月 30 日（完整 12 个月）

### 时间转换函数 (`convertTimeToHours`)

代码假设时间字段使用特殊格式：
- **值 < 100**: 表示分钟，除以 60 转换为小时
  - 例如: `45` = 45 分钟 = 0.75 小时
- **值 >= 100**: 表示 HHMM 格式（前 100 = 1 小时，余数 = 分钟）
  - 例如: `630` = 6 小时 30 分钟 = 6.5 小时
  - 例如: `112` = 1 小时 12 分钟 = 1.2 小时

**重要**: 函数会先将值四舍五入到整数，然后应用上述规则。

### 可能的问题

#### 问题 1: 数据格式不匹配
如果数据库中的 `time` 字段实际存储的是**十进制小时**（如 `6.5` 表示 6.5 小时），但代码按 HHMM 格式处理：
- `6.5` → 四舍五入到 `7` → 因为 7 < 100，所以计算为 `7/60 = 0.117` 小时 ❌ **会严重低估**

如果数据是 HHMM 格式但被当作十进制小时处理：
- `630` → 如果直接使用 = 630 小时 ❌ **会严重高估**

#### 问题 2: Staff 名称匹配问题
- 数据库中的 staff 名称可能有前导/尾随空格
- 前端选择的是 "Mark Lane"，但数据库中可能是 "Mark Lane "（有空格）
- 这会导致过滤失败，显示所有员工的数据总和

#### 问题 3: 日期范围问题
- 检查前端选择的 as-of 日期是否正确
- 检查财年计算逻辑是否正确

## 调试步骤

### 步骤 1: 运行调试查询
使用 `debug_mark_lane_hours.sql` 文件中的查询：

1. **检查原始数据格式** - 查看 `time` 字段的实际值
2. **计算月度总计** - 使用 API 转换逻辑计算
3. **数据质量检查** - 查找 NULL、0 值等异常
4. **Staff 名称变体** - 检查是否有空格或拼写差异

### 步骤 2: 验证数据格式
运行以下查询查看时间值的分布：

```sql
SELECT 
  time,
  COUNT(*) as count,
  -- API 转换结果
  CASE 
    WHEN ROUND(time) < 100 THEN ROUND(time) / 60.0
    ELSE FLOOR(ROUND(time) / 100) + (ROUND(time)::int % 100) / 60.0
  END as api_hours
FROM timesheet_uploads
WHERE organization_id = '<your_org_id>'
  AND staff = 'Mark Lane'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY time
ORDER BY time
LIMIT 50;
```

**判断标准**:
- 如果大部分 `time` 值 < 100，且看起来像分钟数（如 30, 45, 60），则格式正确
- 如果大部分 `time` 值 >= 100，且看起来像 HHMM（如 630, 800, 1200），则格式正确
- 如果 `time` 值是小数且 < 24（如 6.5, 7.25, 8.0），则数据是十进制小时格式，**代码需要修复**

### 步骤 3: 检查 Staff 过滤
```sql
-- 检查所有可能的 Mark Lane 变体
SELECT DISTINCT 
  staff,
  LENGTH(staff) as name_length,
  COUNT(*) as records
FROM timesheet_uploads
WHERE organization_id = '<your_org_id>'
  AND staff ILIKE '%Mark Lane%'
  AND date >= '2024-07-01'
  AND date <= '2024-09-30'
  AND billable = true
GROUP BY staff;
```

### 步骤 4: 对比 API 结果
在浏览器开发者工具中：
1. 打开 Network 标签
2. 访问 Productivity 页面
3. 选择 Mark Lane 并点击 Update
4. 查看 `/api/productivity/monthly?staff=Mark%20Lane&...` 的响应
5. 对比 July, August, September 的值

## 修复方案

### 如果数据是十进制小时格式
需要修改 `convertTimeToHours` 函数，使其能够识别数据格式：

```typescript
function convertTimeToHours(timeValue: number | string | null): number {
  if (timeValue === null || timeValue === undefined) return 0
  
  const numValue = typeof timeValue === 'string' ? parseFloat(timeValue) : timeValue
  if (isNaN(numValue) || numValue <= 0) return 0
  
  // 如果值 < 24，很可能是十进制小时格式
  if (numValue < 24 && numValue !== Math.round(numValue)) {
    // 有小数部分，且 < 24，应该是十进制小时
    return numValue
  }
  
  // 否则按原逻辑处理（HHMM 或分钟格式）
  const roundedValue = Math.round(numValue)
  
  if (roundedValue < 100) {
    return roundedValue / 60
  } else {
    const hours = Math.floor(roundedValue / 100)
    const minutes = roundedValue % 100
    return hours + (minutes / 60)
  }
}
```

### 如果 Staff 名称有空格问题
在 API 查询中使用 `TRIM()` 或 `ILIKE`：

```typescript
if (staffFilter) {
  query = query.ilike('staff', staffFilter.trim())
}
```

## 为什么只有 Mark Lane 的 7-9 月数据有问题？

如果转换函数有问题，理论上所有数据都应该有问题。但只有特定数据异常，可能的原因：

### 可能原因 1: 重复记录
- **问题**: Mark Lane 的 7-9 月数据可能被重复上传
- **表现**: 同样的记录在数据库中存在多次，每次都被计算
- **检查**: 运行 `debug_specific_issue.sql` 中的 Issue 1 查询

### 可能原因 2: Staff 名称变体导致重复计算
- **问题**: 数据库中可能有多个变体：
  - "Mark Lane"
  - "Mark Lane " (尾随空格)
  - "Mark  Lane" (双空格)
- **表现**: API 只过滤一个变体，但实际数据包含多个，导致总数偏高
- **检查**: 运行 Issue 2 查询，查看所有 Mark Lane 变体

### 可能原因 3: 数据格式不一致
- **问题**: Mark Lane 的 7-9 月数据可能使用了不同的格式
  - 其他月份/员工: HHMM 格式 (如 630 = 6.5小时) ✅
  - Mark Lane 7-9月: 十进制小时格式 (如 6.5 = 6.5小时) ❌
- **表现**: 如果数据是十进制小时但代码按 HHMM 处理：
  - `6.5` → 四舍五入到 `7` → `7/60 = 0.117` 小时（会低估）
  - 但如果数据是 `650`（应该是 6.5 小时但被误存为 650）：
  - `650` → `6 + 50/60 = 6.83` 小时（接近但不对）
  - 或者如果数据是 `6500`（应该是 6.5 小时但被误存）：
  - `6500` → `65 + 0/60 = 65` 小时（会严重高估！）
- **检查**: 运行 Issue 3 和 Issue 7 查询，对比数据格式

### 可能原因 4: 多次上传导致重复
- **问题**: 7-9 月的数据可能被上传了多次，但删除操作没有完全清理
- **表现**: 同样的日期范围有多个上传批次
- **检查**: 运行 Issue 5 查询，查看上传历史

### 可能原因 5: 异常大的时间值
- **问题**: 某些记录的 `time` 值异常大（如 6500, 8000）
- **表现**: 如果这些值被当作 HHMM 格式处理，会产生巨大的小时数
  - `6500` → `65 + 0/60 = 65` 小时
  - `8000` → `80 + 0/60 = 80` 小时
- **检查**: 运行 Issue 4 和 Issue 7 查询，查找异常值

## 调试步骤（按优先级）

### 步骤 1: 检查重复记录和 Staff 名称变体
运行 `debug_specific_issue.sql` 中的：
- **Issue 1**: 查找完全重复的记录
- **Issue 2**: 查找 Staff 名称变体

### 步骤 2: 检查数据格式
运行：
- **Issue 3**: 对比 Mark Lane 与其他员工的数据格式
- **Issue 7**: 查看时间值的分布和转换结果

### 步骤 3: 检查异常值
运行：
- **Issue 4**: 对比 7-9 月与其他月份
- **Issue 5**: 检查上传历史

## 下一步
1. **优先运行** `debug_specific_issue.sql` 中的 Issue 1, 2, 7 查询
2. 根据结果确定问题根源：
   - 如果是重复记录 → 清理数据库
   - 如果是 Staff 名称变体 → 修复 API 过滤逻辑
   - 如果是数据格式问题 → 修复转换函数
   - 如果是异常值 → 检查数据源/上传逻辑
3. 应用相应的修复
