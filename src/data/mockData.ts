import { AdvicePost } from "../types";

export const mockFeed: AdvicePost[] = [
  {
    id: "q1",
    title: "Should I switch careers at 24?",
    body: "I feel stuck in marketing and want to move to software. Is it realistic to switch this year?",
    category: "Career",
    author: "Anon_102",
    anonymous: true,
    votes: 128,
    replies: 41,
    createdAt: "2h ago",
  },
  {
    id: "q2",
    title: "My friend keeps crossing boundaries",
    body: "How do I confront a close friend without ending the friendship?",
    category: "Relationships",
    author: "Nab",
    anonymous: false,
    votes: 96,
    replies: 28,
    createdAt: "5h ago",
  },
  {
    id: "q3",
    title: "Do I pay debt first or build savings?",
    body: "I have high-interest debt and no emergency fund. What should I prioritize?",
    category: "Money",
    author: "Anon_599",
    anonymous: true,
    votes: 74,
    replies: 19,
    createdAt: "1d ago",
  },
];
