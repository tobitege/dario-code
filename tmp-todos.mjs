#!/usr/bin/env node

/**
 * Simple test script for the todo functionality
 */
console.log('This is a mock implementation of adding todos.');
console.log('In a real implementation, you would use the TodoWrite tool directly from Claude.');
console.log('\nHere are 5 example todos:');

const todos = [
  { content: 'Implement search functionality', status: 'pending', priority: 'high' },
  { content: 'Fix authentication bug', status: 'in_progress', priority: 'high' },
  { content: 'Update documentation', status: 'pending', priority: 'medium' },
  { content: 'Add unit tests', status: 'pending', priority: 'medium' },
  { content: 'Refactor error handling', status: 'completed', priority: 'low' }
];

// Display formatted todos
console.log('\nTodo List:');
todos.forEach((todo, index) => {
  const statusIcon = {
    pending: '[ ]',
    in_progress: '[~]',
    completed: '[x]'
  }[todo.status];
  
  const priority = todo.priority ? ` (${todo.priority})` : '';
  console.log(`${index + 1}. ${statusIcon} ${todo.content}${priority}`);
});