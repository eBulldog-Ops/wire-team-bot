import type { Task, TaskStatus, TaskPriority } from "../entities/Task";
import type { QualifiedId } from "../ids/QualifiedId";

export interface TaskQuery {
  conversationId?: QualifiedId;
  assigneeId?: QualifiedId;
  creatorId?: QualifiedId;
  statusIn?: TaskStatus[];
  searchText?: string;
  limit?: number;
}

export interface TaskRepository {
  create(task: Task): Promise<Task>;
  update(task: Task): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  query(criteria: TaskQuery): Promise<Task[]>;
  nextId(): Promise<string>; // e.g. returns next TASK-0001 style ID
}

