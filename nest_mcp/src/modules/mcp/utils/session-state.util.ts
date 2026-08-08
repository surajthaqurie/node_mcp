/**
 * @file session-state.util.ts
 * @description State container for active listing pagination and pending payload confirmation.
 *
 * WHY THIS EXISTS:
 * Encapsulates multi-turn session tracking (e.g. current list tool for "next/prev" pagination
 * and unconfirmed payload state for multi-turn form filling) outside of OllamaService.
 */

export class McpSessionState {
  private lastListTool: string = 'list_users';
  private lastPage: number = 1;
  private lastPendingTool: string | null = null;
  private lastPendingArgs: Record<string, unknown> = {};

  public getListTool(): string {
    return this.lastListTool;
  }

  public getPage(): number {
    return this.lastPage;
  }

  public setPage(page: number): void {
    this.lastPage = Math.max(1, page);
  }

  public trackListOperation(toolName: string, page: number): void {
    if (['list_users', 'list_tasks', 'list_comments'].includes(toolName)) {
      this.lastListTool = toolName;
      this.lastPage = page || 1;
    }
  }

  public getPendingTool(): string | null {
    return this.lastPendingTool;
  }

  public getPendingArgs(): Record<string, unknown> {
    return { ...this.lastPendingArgs };
  }

  public setPendingPayload(
    toolName: string,
    args: Record<string, unknown>,
  ): void {
    this.lastPendingTool = toolName;
    this.lastPendingArgs = { ...this.lastPendingArgs, ...args, confirm: true };
  }

  public clearPendingPayload(): void {
    this.lastPendingTool = null;
    this.lastPendingArgs = {};
  }

  public handleToolOutcome(
    toolName: string,
    args: Record<string, unknown>,
    resultText: string,
  ): void {
    if (
      resultText.includes('⚠️ Payload Validation Failed') ||
      resultText.includes('📋 Payload Confirmation Required')
    ) {
      this.setPendingPayload(toolName, args);
    } else {
      this.clearPendingPayload();
    }
  }
}
