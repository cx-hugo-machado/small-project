"""Variant of main.py referencing multiple external MCP servers in a single
mcp_servers list, to exercise the connector's multi-server support.
"""

import anthropic

client = anthropic.Anthropic()


def main() -> None:
    response = client.beta.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Check my Stripe balance and latest GitHub issues."}],
        mcp_servers=[
            {"type": "url", "url": "https://mcp.stripe.com", "name": "stripe"},
            {"type": "url", "url": "https://api.githubcopilot.com/mcp", "name": "github"},
        ],
        extra_headers={"anthropic-beta": "mcp-client-2025-04-04"},
    )

    for block in response.content:
        print(block)


if __name__ == "__main__":
    main()
