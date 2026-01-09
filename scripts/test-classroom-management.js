#!/usr/bin/env node

/**
 * ClassIn 课节管理功能测试脚本
 * 用于验证修改和删除课节功能的API端点
 */

const testEndpoints = [
  {
    name: '获取测试API说明',
    method: 'GET',
    url: 'http://localhost:3000/api/classin/classrooms/test',
    body: null
  },
  {
    name: '测试修改课节（模拟）',
    method: 'POST',
    url: 'http://localhost:3000/api/classin/classrooms/test',
    body: {
      action: 'edit',
      SID: 'your-classin-sid',
      safeKey: 'your-classin-safekey',
      timeStamp: '1484719085',
      courseId: 442447,
      classId: 23644,
      className: '测试修改课节名称'
    }
  },
  {
    name: '测试删除课节（模拟）',
    method: 'POST',
    url: 'http://localhost:3000/api/classin/classrooms/test',
    body: {
      action: 'delete',
      SID: 'your-classin-sid',
      safeKey: 'your-classin-safekey',
      timeStamp: '1484719085',
      courseId: 442447,
      classId: 23644
    }
  }
]

console.log('ClassIn 课节管理功能测试')
console.log('请确保开发服务器正在运行 (npm run dev)')
console.log('=' * 50)

testEndpoints.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`)
  console.log(`   方法: ${test.method}`)
  console.log(`   URL: ${test.url}`)
  if (test.body) {
    console.log(`   请求体: ${JSON.stringify(test.body, null, 2)}`)
  }
})

console.log('\n' + '=' * 50)
console.log('使用 curl 命令测试:')
console.log()

testEndpoints.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}:`)
  
  if (test.method === 'GET') {
    console.log(`curl -X GET "${test.url}"`)
  } else {
    console.log(`curl -X POST "${test.url}" \\`)
    console.log(`  -H "Content-Type: application/json" \\`)
    console.log(`  -d '${JSON.stringify(test.body)}'`)
  }
  console.log()
})

console.log('注意事项:')
console.log('1. 确保在 .env.local 中配置了 CLASSIN_SID 和 CLASSIN_SECRET')
console.log('2. 测试数据中的 courseId 和 classId 需要替换为实际的值')
console.log('3. 建议先在测试环境中验证功能')
console.log('4. 使用传统的 SID/safeKey 认证方式，不是 LMS API')
