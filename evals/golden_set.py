"""
AgentForgeV2 — Tool Call Eval Golden Set

105 条测试用例：75 正例 + 20 反例 + 10 混淆场景。
每条用例 = (用户输入, 期望调用的工具名, 分类, 标签)。

维护规则：
  - 用户反馈"AI 没调对工具" → 把真实输入加一条
  - 改了 tool description → 跑一遍 eval
  - 换了 LLM 模型 → 跑一遍 eval
"""

from dataclasses import dataclass, field


@dataclass
class EvalCase:
    id: int
    input: str
    expected_tool: str | None  # None = 不应该调工具
    category: str
    tags: list[str] = field(default_factory=list)


GOLDEN_SET: list[EvalCase] = [
    # ── calculator ──
    EvalCase(1, "帮我算一下 128.5 * 3.14", "calculator", "calculator", ["core"]),
    EvalCase(2, "项目预算人力15万、外包8万、设备3万，总成本多少", "calculator", "calculator", ["core", "indirect"]),
    EvalCase(3, "这个月转化率从 2.3% 提升到 3.1%，提升了多少个百分点", "calculator", "calculator", ["core"]),
    EvalCase(4, "圆周率是多少", None, "calculator", ["core", "negative"]),

    # ── datetime ──
    EvalCase(5, "今天几号", "datetime", "datetime", ["core"]),
    EvalCase(6, "距离国庆节还有几天", "datetime", "datetime", ["core", "indirect"]),
    EvalCase(7, "中国的时区是什么", None, "datetime", ["core", "negative"]),

    # ── web_search ──
    EvalCase(8, "搜一下最近的AI行业新闻", "web_search", "web_search", ["core"]),
    EvalCase(9, "华为最新发布了什么手机", "web_search", "web_search", ["core", "indirect"]),
    EvalCase(10, "今天深圳天气怎么样", "web_search", "web_search", ["core"]),
    EvalCase(11, "什么是大语言模型", None, "web_search", ["core", "negative"]),

    # ── search_knowledge ──
    EvalCase(12, "查一下知识库里关于广告投放的文档", "search_knowledge", "knowledge", ["core"]),
    EvalCase(13, "我们之前有没有做过竞品分析的报告", "search_knowledge", "knowledge", ["core", "indirect"]),
    EvalCase(14, "帮我搜一下公司内部的CPD定价策略", "search_knowledge", "knowledge", ["core"]),

    # ── excel_processor ──
    EvalCase(15, "帮我创建一个Excel报表", "excel_processor", "excel", ["core"]),
    EvalCase(16, "生成一个包含姓名和成绩的表格", "excel_processor", "excel", ["core", "indirect"]),
    EvalCase(17, "读取一下刚才上传的Excel文件", "excel_processor", "excel", ["core"]),
    EvalCase(18, "帮我整理一下这些数据到表格里", "excel_processor", "excel", ["core", "indirect"]),

    # ── word_processor ──
    EvalCase(19, "帮我写一份项目周报", "word_processor", "word", ["core"]),
    EvalCase(20, "生成一份会议纪要文档", "word_processor", "word", ["core"]),
    EvalCase(21, "写一个产品需求文档", "word_processor", "word", ["core"]),
    EvalCase(22, "做一份竞品分析报告", "word_processor", "word", ["core"]),

    # ── ppt_processor ──
    EvalCase(23, "帮我做一个PPT", "ppt_processor", "ppt", ["core"]),
    EvalCase(24, "创建一份项目汇报演示文稿", "ppt_processor", "ppt", ["indirect"]),

    # ── pdf_processor ──
    EvalCase(25, "读取这个PDF的内容", "pdf_processor", "pdf", ["core"]),
    EvalCase(26, "这个PDF有多少页", "pdf_processor", "pdf", []),

    # ── text_file_writer ──
    EvalCase(27, "帮我创建一个Markdown文件", "text_file_writer", "text_file", ["core"]),
    EvalCase(28, "把结果保存为CSV", "text_file_writer", "text_file", []),
    EvalCase(29, "生成一个JSON配置文件", "text_file_writer", "text_file", []),

    # ── document_converter ──
    EvalCase(30, "把这个Word文档转成PDF", "document_converter", "converter", ["core"]),
    EvalCase(31, "导出为PDF格式", "document_converter", "converter", ["indirect"]),

    # ── manage_priority ──
    EvalCase(32, "帮我创建一个待办：明天提交周报", "manage_priority", "workstation", ["core"]),
    EvalCase(33, "我有哪些待办事项", "manage_priority", "workstation", ["core"]),
    EvalCase(34, "把提交周报这个任务标记为完成", "manage_priority", "workstation", ["core"]),

    # ── manage_schedule ──
    EvalCase(35, "帮我安排明天下午3点开会", "manage_schedule", "workstation", ["core"]),
    EvalCase(36, "查看一下我这周的日程", "manage_schedule", "workstation", ["core"]),
    EvalCase(37, "30分钟后提醒我给老板打电话", "manage_schedule", "workstation", ["indirect"]),

    # ── manage_followup ──
    EvalCase(38, "帮我记一个跟进事项：下周和供应商确认报价", "manage_followup", "workstation", []),
    EvalCase(39, "我有哪些需要跟进的事情", "manage_followup", "workstation", []),

    # ── manage_work_item ──
    EvalCase(40, "创建一个工作项：完成Q2广告优化方案", "manage_work_item", "workstation", []),
    EvalCase(41, "查看我负责的工作项", "manage_work_item", "workstation", []),

    # ── code_executor ──
    EvalCase(42, "帮我写一段Python脚本来处理这些数据", "code_executor", "code", []),
    EvalCase(43, "用代码分析一下这个CSV文件的数据分布", "code_executor", "code", ["indirect"]),
    EvalCase(44, "Python 的 list comprehension 怎么用", None, "code", ["negative"]),

    # ── text_processor ──
    EvalCase(45, "帮我统计一下这段文字有多少字", "text_processor", "text", []),
    EvalCase(46, "把这段英文翻译成中文", None, "text", ["negative"]),

    # ── http_request ──
    EvalCase(47, "调一下这个API: https://api.example.com/data", "http_request", "http", []),
    EvalCase(48, "HTTP 的 GET 和 POST 有什么区别", None, "http", ["negative"]),

    # ── email_sender ──
    EvalCase(49, "发一封邮件给 zhangsan@company.com", "email_sender", "email", []),

    # ── chart_generator ──
    EvalCase(50, "用柱状图展示各月的销售额", "chart_generator", "chart", []),
    EvalCase(51, "帮我画一个趋势图看看增长情况", "chart_generator", "chart", ["indirect"]),

    # ── list_workflows / run_workflow ──
    EvalCase(52, "有哪些可用的工作流", "list_workflows", "workflow", []),
    EvalCase(53, "执行一下周报生成工作流", "run_workflow", "workflow", []),
    EvalCase(54, "什么是工作流", None, "workflow", ["negative"]),

    # ── list_knowledge_files ──
    EvalCase(55, "知识库里有哪些文档", "list_knowledge_files", "knowledge", []),

    # ── shell_executor ──
    EvalCase(56, "帮我看看当前目录有哪些文件", "shell_executor", "shell", []),

    # ── data_analysis ──
    EvalCase(57, "分析一下这组数据的趋势", "data_analysis", "data", []),
    EvalCase(58, "帮我做个数据透视表", "data_analysis", "data", []),

    # ── 反例：不应调任何工具（20 条）──
    EvalCase(59, "你好", None, "negative", ["core", "negative"]),
    EvalCase(60, "谢谢", None, "negative", ["core", "negative"]),
    EvalCase(61, "你是谁", None, "negative", ["core", "negative"]),
    EvalCase(62, "今天心情不好", None, "negative", ["negative"]),
    EvalCase(63, "什么是敏捷开发", None, "negative", ["negative"]),
    EvalCase(64, "项目管理有哪些方法论", None, "negative", ["negative"]),
    EvalCase(65, "帮我分析一下这个方案的优缺点", None, "negative", ["negative"]),
    EvalCase(66, "你觉得这个计划怎么样", None, "negative", ["negative"]),
    EvalCase(67, "给我一些建议", None, "negative", ["negative"]),
    EvalCase(68, "总结一下刚才的讨论", None, "negative", ["negative"]),
    EvalCase(69, "解释一下什么是 OKR", None, "negative", ["negative"]),
    EvalCase(70, "广告 CPM 和 CPC 的区别是什么", None, "negative", ["negative"]),
    EvalCase(71, "你能做什么", None, "negative", ["negative"]),
    EvalCase(72, "继续", None, "negative", ["negative"]),
    EvalCase(73, "好的", None, "negative", ["negative"]),
    EvalCase(74, "不对，我想要的是另一种方案", None, "negative", ["negative"]),
    EvalCase(75, "为什么这样做比较好", None, "negative", ["negative"]),
    EvalCase(76, "讲一个笑话", None, "negative", ["negative"]),
    EvalCase(77, "你支持哪些功能", None, "negative", ["negative"]),
    EvalCase(78, "这个项目的风险在哪里", None, "negative", ["negative"]),

    # ── 竞争/混淆场景（10 条）──
    EvalCase(79, "帮我做一个Excel图表", "excel_processor", "confuse", ["boundary"]),
    EvalCase(80, "画一个柱状图", "chart_generator", "confuse", ["boundary"]),
    EvalCase(81, "帮我整理会议纪要并发给团队", "word_processor", "confuse", ["boundary"]),
    EvalCase(82, "帮我查一下最新的广告数据", "search_knowledge", "confuse", ["core", "boundary"]),
    EvalCase(83, "搜一下行业平均 CPM 是多少", "web_search", "confuse", ["core", "boundary"]),
    EvalCase(84, "把上面的分析保存成文件", "text_file_writer", "confuse", ["boundary"]),
    EvalCase(85, "帮我写一份详细的分析报告", "word_processor", "confuse", ["boundary"]),
    EvalCase(86, "把计算结果写入Excel", "excel_processor", "confuse", ["boundary"]),
    EvalCase(87, "帮我起草一封给客户的邮件", "word_processor", "confuse", ["boundary"]),
    EvalCase(88, "帮我写一封邮件给客户介绍产品", "word_processor", "confuse", ["boundary"]),
]
