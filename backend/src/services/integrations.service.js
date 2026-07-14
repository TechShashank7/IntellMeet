export async function postMeetingToSlack(session, team) {
  if (!team.slackWebhookUrl) {
    throw new Error("Slack webhook URL is not configured for this team");
  }

  const formatTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const actionItemsBlocks = session.actionItems && session.actionItems.length > 0
    ? session.actionItems.map(ai => {
        const assigneeName = ai.assigneeName || "Unassigned";
        const dateText = ai.dueDate ? formatTime(ai.dueDate) : "No due date";
        return {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• ${ai.text} _[${assigneeName} - ${dateText}]_`
          }
        };
      })
    : [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "No action items."
          }
        }
      ];

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: session.topic || "Meeting Summary",
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Summary*\n${session.summary || "No summary yet."}`
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Action Items*"
      }
    },
    ...actionItemsBlocks
  ];

  const response = await fetch(team.slackWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Slack API error: ${errorBody}`);
  }

  return { success: true };
}

export async function syncMeetingToNotion(session, team) {
  if (!team.notionToken || !team.notionPageId) {
    throw new Error("Notion integration is not fully configured for this team");
  }

  const formatTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const summaryParagraphs = (session.summary || "No summary yet.")
    .split("\n")
    .filter(l => l.trim().length > 0)
    .map(line => ({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: line.replace(/^-?\s*/, "").trim()
            }
          }
        ]
      }
    }));

  const actionItemBlocks = session.actionItems && session.actionItems.length > 0
    ? session.actionItems.map(ai => {
        const assigneeName = ai.assigneeName || "Unassigned";
        const dateText = ai.dueDate ? formatTime(ai.dueDate) : "No due date";
        return {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `${ai.text} [${assigneeName} - ${dateText}]`
                }
              }
            ]
          }
        };
      })
    : [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "No action items."
                }
              }
            ]
          }
        }
      ];

  const children = [
    {
      object: "block",
      type: "heading_1",
      heading_1: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Summary"
            }
          }
        ]
      }
    },
    ...summaryParagraphs,
    {
      object: "block",
      type: "heading_1",
      heading_1: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Action Items"
            }
          }
        ]
      }
    },
    ...actionItemBlocks
  ];

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${team.notionToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      parent: { page_id: team.notionPageId },
      properties: {
        title: {
          title: [
            {
              type: "text",
              text: {
                content: session.topic || "Meeting Summary"
              }
            }
          ]
        }
      },
      children
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Notion API error: ${errorBody}`);
  }

  const data = await response.json();
  return { success: true, url: data.url };
}
