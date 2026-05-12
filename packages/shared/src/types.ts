import { z } from 'zod';

export const TaskStatus = z.enum([
  'pending',
  'in_progress',
  'awaiting_review',
  'approved',
  'denied',
  'failed',
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const BeeRunStatus = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'denied_by_compliance',
  'denied_by_critic',
]);
export type BeeRunStatus = z.infer<typeof BeeRunStatus>;

export const ReviewStatus = z.enum(['pending', 'approved', 'denied', 'expired']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const SitePolicyStatus = z.enum(['allow', 'deny', 'negotiated']);
export type SitePolicyStatus = z.infer<typeof SitePolicyStatus>;

export const BeeType = z.enum(['research', 'application', 'housing', 'procurement', 'form']);
export type BeeType = z.infer<typeof BeeType>;

export const TaskInput = z.object({
  prompt: z.string().min(1).max(4000),
});
export type TaskInput = z.infer<typeof TaskInput>;

export const JobPostingResult = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  url: z.string().url(),
  source: z.string(),
  postedAt: z.string().nullable(),
});
export type JobPostingResult = z.infer<typeof JobPostingResult>;

export const ResearchBeeOutput = z.object({
  query: z.string(),
  results: z.array(JobPostingResult).max(50),
  notes: z.string().optional(),
});
export type ResearchBeeOutput = z.infer<typeof ResearchBeeOutput>;
