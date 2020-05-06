import { Tasklist } from "./Tasklist";

export interface Task {
  title: string;
  task(ctx?: any, task?: Task, tasks?: Task[]): NodeJS.ReadableStream | Tasklist | Promise<any>;
}
