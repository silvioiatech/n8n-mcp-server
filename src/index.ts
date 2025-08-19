import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosResponse } from 'axios';
import { z } from 'zod';

// Configuration
const N8N_HOST = process.env.N8N_API_URL || process.env.N8N_HOST || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const PORT = process.env.PORT || 3000;

// Validation schemas
const WorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  active: z.boolean().optional(),
  nodes: z.array(z.any()),
  connections: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
});

// N8N API Client
class N8NClient {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseURL = N8N_HOST.endsWith('/') ? N8N_HOST.slice(0, -1) : N8N_HOST;
    if (!this.baseURL.includes('/api/v1')) {
      this.baseURL += '/api/v1';
    }
    
    this.headers = {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    };
  }

  async request(method: string, endpoint: string, data?: any): Promise<any> {
    try {
      const response: AxiosResponse = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: this.headers,
        data,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`N8N API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  async listWorkflows() {
    return this.request('GET', '/workflows');
  }

  async getWorkflow(id: string) {
    return this.request('GET', `/workflows/${id}`);
  }

  async createWorkflow(workflow: any) {
    return this.request('POST', '/workflows', workflow);
  }

  async updateWorkflow(id: string, workflow: any) {
    return this.request('PUT', `/workflows/${id}`, workflow);
  }

  async deleteWorkflow(id: string) {
    return this.request('DELETE', `/workflows/${id}`);
  }

  async activateWorkflow(id: string) {
    return this.request('POST', `/workflows/${id}/activate`);
  }

  async deactivateWorkflow(id: string) {
    return this.request('POST', `/workflows/${id}/deactivate`);
  }

  async executeWorkflow(id: string, data?: any) {
    return this.request('POST', `/workflows/${id}/execute`, data);
  }

  async getExecutions(workflowId?: string) {
    const endpoint = workflowId ? `/executions?workflowId=${workflowId}` : '/executions';
    return this.request('GET', endpoint);
  }
}

// MCP Server
class N8NMCPServer {
  private server: Server;
  private n8nClient: N8NClient;

  constructor() {
    this.server = new Server(
      {
        name: 'n8n-workflow-builder',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.n8nClient = new N8NClient();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_workflows',
            description: 'List all workflows from n8n instance',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_workflow',
            description: 'Get detailed information about a specific workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Workflow ID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'create_workflow',
            description: 'Create a new workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow: {
                  type: 'object',
                  description: 'Workflow definition with name, nodes, and connections',
                },
              },
              required: ['workflow'],
            },
          },
          {
            name: 'update_workflow',
            description: 'Update an existing workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Workflow ID' },
                workflow: { type: 'object', description: 'Updated workflow data' },
              },
              required: ['id', 'workflow'],
            },
          },
          {
            name: 'delete_workflow',
            description: 'Delete a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Workflow ID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'activate_workflow',
            description: 'Activate a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Workflow ID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'deactivate_workflow',
            description: 'Deactivate a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Workflow ID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'execute_workflow',
            description: 'Execute a workflow manually',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Workflow ID' },
                data: { type: 'object', description: 'Input data for execution' },
              },
              required: ['id'],
            },
          },
          {
            name: 'get_executions',
            description: 'Get workflow execution history',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: { type: 'string', description: 'Filter by workflow ID (optional)' },
              },
            },
          },
        ] as Tool[],
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_workflows':
            const workflows = await this.n8nClient.listWorkflows();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflows, null, 2),
                },
              ],
            };

          case 'get_workflow':
            const workflow = await this.n8nClient.getWorkflow(args.id);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflow, null, 2),
                },
              ],
            };

          case 'create_workflow':
            const created = await this.n8nClient.createWorkflow(args.workflow);
            return {
              content: [
                {
                  type: 'text',
                  text: `Workflow created successfully: ${JSON.stringify(created, null, 2)}`,
                },
              ],
            };

          case 'update_workflow':
            const updated = await this.n8nClient.updateWorkflow(args.id, args.workflow);
            return {
              content: [
                {
                  type: 'text',
                  text: `Workflow updated successfully: ${JSON.stringify(updated, null, 2)}`,
                },
              ],
            };

          case 'delete_workflow':
            await this.n8nClient.deleteWorkflow(args.id);
            return {
              content: [
                {
                  type: 'text',
                  text: `Workflow ${args.id} deleted successfully`,
                },
              ],
            };

          case 'activate_workflow':
            const activated = await this.n8nClient.activateWorkflow(args.id);
            return {
              content: [
                {
                  type: 'text',
                  text: `Workflow ${args.id} activated successfully: ${JSON.stringify(activated, null, 2)}`,
                },
              ],
            };

          case 'deactivate_workflow':
            const deactivated = await this.n8nClient.deactivateWorkflow(args.id);
            return {
              content: [
                {
                  type: 'text',
                  text: `Workflow ${args.id} deactivated successfully: ${JSON.stringify(deactivated, null, 2)}`,
                },
              ],
            };

          case 'execute_workflow':
            const execution = await this.n8nClient.executeWorkflow(args.id, args.data);
            return {
              content: [
                {
                  type: 'text',
                  text: `Workflow executed: ${JSON.stringify(execution, null, 2)}`,
                },
              ],
            };

          case 'get_executions':
            const executions = await this.n8nClient.getExecutions(args.workflowId);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(executions, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('N8N MCP Server running...');
  }
}

// Start server
if (require.main === module) {
  const server = new N8NMCPServer();
  server.run().catch(console.error);
}
