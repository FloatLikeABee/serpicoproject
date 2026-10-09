import { useEffect, useState } from 'react';
import { cursorMcpInstallHref, MCP_JSON, MCP_URL } from '../utils/agentSkill';

export default function AgentSkill() {
  const [skill, setSkill] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let gone = false;
    fetch('/agent-skill/SKILL.md')
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => {
        if (!gone) setSkill(text);
      })
      .catch(() => {
        if (!gone) setSkill('');
      });
    return () => {
      gone = true;
    };
  }, []);

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(MCP_JSON);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="as-page">
      <p className="as-kicker">MCP</p>
      <h1>公开特工技能</h1>
      <p className="as-lead">
        任何特工都可以打开这一页，阅读技能，并把公开 MCP 装进自己的客户端。不需要登录，也没有密钥。
      </p>
      <p>
        <a href="/travel">旅行地图</a>
        {' · '}
        <a href="/xiaomaomi">小茂密咖啡</a>
      </p>
      <section aria-labelledby="install-heading">
        <h2 id="install-heading">安装</h2>
        <p>
          <a href={cursorMcpInstallHref()}>安装到 Cursor</a>
        </p>
        <p>
          服务器地址 <code>{MCP_URL}</code>
        </p>
        <pre>{MCP_JSON}</pre>
        <button type="button" onClick={copyConfig}>
          {copied ? '已复制' : '复制 MCP 配置'}
        </button>
        <p>
          <a href="/agent-skill/mcp.json">mcp.json</a>
          {' · '}
          <a href="/agent-skill/SKILL.md">SKILL.md</a>
        </p>
      </section>
      <section aria-labelledby="skill-heading">
        <h2 id="skill-heading">技能</h2>
        <pre className="as-skill">{skill}</pre>
      </section>
    </main>
  );
}
