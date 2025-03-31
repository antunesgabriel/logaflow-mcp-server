import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import axios, { AxiosRequestConfig } from "axios";

// Configuration
dotenv.config();

const API_KEY = process.env.LOGAFLOW_API_KEY;
if (!API_KEY) {
  throw new Error("LOGAFLOW_API_KEY environment variable is required");
}

const LOGAFLOW_API_URL =
  process.env.LOGAFLOW_API_URL ?? "https://api.logaflow.com/v1";

// --- Resource Definitions ---
const projectSchema = z.object({
  projectId: z.string().describe("Unique identifier of the project"),
  projectName: z.string().describe("Name of the project"),
  userRole: z.string().describe("Role of the user in the project"),
});

const feedbackAuthorSchema = z.object({
  id: z.string().describe("Unique identifier of the feedback author"),
  name: z.string().describe("Name of the feedback author"),
  email: z.string().describe("Email of the feedback author"),
  avatar: z.string().describe("URL of the feedback author's avatar"),
  customFields: z
    .record(z.any())
    .nullable()
    .describe("Custom fields associated with the author"),
});

const feedbackSchema = z.object({
  id: z.string().describe("Unique identifier of the feedback"),
  url: z.string().nullable().describe("URL associated with the feedback"),
  type: z.string().describe("Type of feedback"),
  title: z.string().describe("Title of the feedback"),
  author: feedbackAuthorSchema.describe("Author of the feedback"),
  comment: z.string().describe("Text of the feedback"),
  assetKey: z
    .string()
    .nullable()
    .describe("Asset key associated with the feedback"),
  isPrivate: z.boolean().describe("Indicates if the feedback is private"),
  projectId: z.string().describe("ID of the project the feedback belongs to"),
  sessionKey: z.string().describe("Session key associated with the feedback"),
  createdAt: z
    .string()
    .datetime()
    .describe("Timestamp when the feedback was created"),
  updatedAt: z
    .string()
    .datetime()
    .nullable()
    .describe("Timestamp when the feedback was last updated"),
});

const projectsSchema = z.array(projectSchema);
const feedbacksSchema = z.array(feedbackSchema);

// --- MCP Server ---
const server = new McpServer({
  name: "Logaflow MCP Server",
  version: "1.0.0",
  capabilities: {
    tools: {},
    prompts: {},
  },
});

// --- Tools ---
server.tool("list_user_projects", {}, async ({}) => {
  const config: AxiosRequestConfig = {
    headers: { "x-api-key": API_KEY, "User-Agent": "MCP Server" },
  };

  try {
    const response = await axios.get(`${LOGAFLOW_API_URL}/projects`, config);
    const parsedData = projectsSchema.parse(response.data.data);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(parsedData, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

server.tool(
  "list_project_feedbacks",
  {
    project_id: z
      .string()
      .describe("The ID of the project to retrieve feedbacks from"),
  },
  async (args) => {
    try {
      const config: AxiosRequestConfig = {
        headers: { "x-api-key": API_KEY, "User-Agent": "MCP Server" },
      };

      const response = await axios.get(
        `${LOGAFLOW_API_URL}/projects/${args.project_id}/feedbacks`,
        config,
      );
      const parsedData = feedbacksSchema.parse(response.data.data.feedbacks);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(parsedData, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "reply_to_feedback",
  {
    feedback_id: z.string().describe("The ID of the feedback to reply to"),
    response: z.string().describe("The text of the reply"),
  },
  async (args) => {
    const config: AxiosRequestConfig = {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "User-Agent": "MCP Server",
      },
    };

    try {
      const data = { response: args.response };
      const response = await axios.post(
        `${LOGAFLOW_API_URL}/feedbacks/${args.feedback_id}/reply`,
        data,
        config,
      );
      const parsedData = z.string().parse(response.data.data);
      return { content: [{ type: "text", text: parsedData }] };
    } catch (error: any) {
      console.error("Error calling Logaflow API:", error);
      throw new Error(`Error replying to feedback: ${error.message}`);
    }
  },
);

// --- Prompts ---
server.prompt(
  "analyze_feedback_trends",
  { project_id: z.string().describe("The ID of the project to analyze") },
  (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Analyze feedback trends for project ${args.project_id}. Use the 'list_project_feedbacks' tool to get the data. Then, analyze the feedback types and creation dates to identify trends.`,
        },
      },
    ],
  }),
);

server.prompt(
  "identify_urgent_bugs",
  {
    project_id: z
      .string()
      .describe("The ID of the project to check for urgent bugs"),
  },
  (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Identify urgent bug reports in project ${args.project_id}. Use the 'list_project_feedbacks' tool to get the data. Filter the feedback where 'type' is 'bug' and look for keywords like 'critical', 'urgent', 'error', 'crash' in the title and comment.`,
        },
      },
    ],
  }),
);

server.prompt(
  "summarize_feedback",
  {
    project_id: z
      .string()
      .describe("The ID of the project to summarize feedback for"),
  },
  (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Summarize the feedback for project ${args.project_id}. Use the 'list_project_feedbacks' tool to get the data. Summarize the key points, grouping similar comments together.`,
        },
      },
    ],
  }),
);

const transport = new StdioServerTransport();
server
  .connect(transport)
  .then(() => console.log("MCP Server started"))
  .catch((error) => console.error("Error starting MCP Server:", error));
