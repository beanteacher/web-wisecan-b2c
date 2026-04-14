package com.wisecan.unified.mcp;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public class PingTool {
    @Tool(description = "서버 헬스 체크 — 입력받은 echo 문자열을 그대로 반환하며, MCP 인증/연결 상태를 확인한다")
    public String ping(@ToolParam(description = "에코할 메시지") String echo) {
        return "pong: " + echo;
    }
}
