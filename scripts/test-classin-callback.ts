/**
 * ClassIn 回调接口测试脚本
 * 用于测试回调接口的基本功能
 */

import crypto from 'crypto';

// 测试配置
const CALLBACK_URL = 'http://localhost:3000/api/classin/callback';
const TEST_SECRET = 'your-secret-key'; // 应该与环境变量中的 CLASSIN_SECRET 一致

/**
 * 生成测试用的 SafeKey
 */
function generateSafeKey(timestamp: number): string {
  return crypto
    .createHash('md5')
    .update(TEST_SECRET + timestamp)
    .digest('hex');
}

/**
 * 测试数据模板
 */
const testCases = [
  {
    name: '测试消息',
    data: {
      SID: 12345,
      Cmd: 'Test',
      Msg: 'This is a test message',
      TimeStamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '举手消息',
    data: {
      SID: 12345,
      Cmd: 'raiseHand',
      UID: 67890,
      userName: 'TestStudent',
      lessonId: 'lesson_123',
      duration: 30,
      TimeStamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '进入教室消息',
    data: {
      SID: 12345,
      Cmd: 'enterRoom',
      UID: 67890,
      userName: 'TestStudent',
      lessonId: 'lesson_123',
      enterTime: new Date().toISOString(),
      TimeStamp: Math.floor(Date.now() / 1000)
    }
  },
  {
    name: '课后汇总消息',
    data: {
      SID: 12345,
      Cmd: 'lessonSummary',
      lessonId: 'lesson_123',
      startTime: '2024-01-01T10:00:00Z',
      endTime: '2024-01-01T10:45:00Z',
      studentCount: 15,
      teacherCount: 1,
      TimeStamp: Math.floor(Date.now() / 1000)
    }
  }
];

/**
 * 执行单个测试用例
 */
async function runTestCase(testCase: any) {
  console.log(`\n🧪 测试用例: ${testCase.name}`);
  console.log('数据:', JSON.stringify(testCase.data, null, 2));

  // 生成 SafeKey
  const safeKey = generateSafeKey(testCase.data.TimeStamp);
  const testData = {
    ...testCase.data,
    SafeKey: safeKey
  };

  try {
    const response = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ClassIn-Callback-Test/1.0'
      },
      body: JSON.stringify(testData)
    });

    const responseText = await response.text();
    console.log(`响应状态: ${response.status} ${response.statusText}`);
    console.log('响应内容:', responseText);

    if (response.ok) {
      try {
        const responseData = JSON.parse(responseText);
        if (responseData.error_info?.errno === 1) {
          console.log('✅ 测试通过');
        } else {
          console.log('❌ 测试失败: 响应错误码不为1');
        }
      } catch (parseError) {
        console.log('❌ 测试失败: 响应不是有效的JSON');
      }
    } else {
      console.log('❌ 测试失败: HTTP状态码不是200');
    }

  } catch (error) {
    console.error('❌ 测试失败: 请求错误', error);
  }
}

/**
 * 测试无效的 SafeKey
 */
async function testInvalidSafeKey() {
  console.log('\n🧪 测试用例: 无效的 SafeKey');
  
  const testData = {
    SID: 12345,
    Cmd: 'Test',
    Msg: 'Test message',
    SafeKey: 'invalid_safe_key_12345',
    TimeStamp: Math.floor(Date.now() / 1000)
  };

  try {
    const response = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const responseText = await response.text();
    console.log(`响应状态: ${response.status} ${response.statusText}`);
    console.log('响应内容:', responseText);

    if (response.status === 401) {
      console.log('✅ 测试通过: 正确拒绝了无效的 SafeKey');
    } else {
      console.log('❌ 测试失败: 应该返回401状态码');
    }

  } catch (error) {
    console.error('❌ 测试失败: 请求错误', error);
  }
}

/**
 * 测试缺少必要字段
 */
async function testMissingFields() {
  console.log('\n🧪 测试用例: 缺少必要字段');
  
  const testData = {
    SID: 12345,
    Cmd: 'Test'
    // 缺少 SafeKey 和 TimeStamp
  };

  try {
    const response = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const responseText = await response.text();
    console.log(`响应状态: ${response.status} ${response.statusText}`);
    console.log('响应内容:', responseText);

    if (response.status === 400) {
      console.log('✅ 测试通过: 正确拒绝了缺少字段的请求');
    } else {
      console.log('❌ 测试失败: 应该返回400状态码');
    }

  } catch (error) {
    console.error('❌ 测试失败: 请求错误', error);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始 ClassIn 回调接口测试');
  console.log(`目标URL: ${CALLBACK_URL}`);
  
  // 检查服务器是否运行
  try {
    const healthResponse = await fetch('http://localhost:3000/api/health', {
      method: 'GET'
    });
    
    if (!healthResponse.ok) {
      console.log('⚠️  服务器可能未运行，请确保开发服务器已启动');
      console.log('运行命令: npm run dev');
    }
  } catch (error) {
    console.log('⚠️  无法连接到服务器，请确保开发服务器已启动');
    console.log('运行命令: npm run dev');
    return;
  }

  // 运行所有测试用例
  for (const testCase of testCases) {
    await runTestCase(testCase);
  }

  // 运行错误场景测试
  await testInvalidSafeKey();
  await testMissingFields();

  console.log('\n🏁 测试完成');
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests, testInvalidSafeKey, testMissingFields };
