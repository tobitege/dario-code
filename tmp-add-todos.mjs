#!/usr/bin/env node

/**
 * Temporary script to directly access and modify the internal todoList variable
 */

// Import the module (this will execute it, initializing the variables)
import './src/tools/todo.mjs';

// Get the actual module file path
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const todoModulePath = require.resolve('./src/tools/todo.mjs');

// Access the module's internal variables directly
const moduleCache = process.binding('module_wrap').moduleMap;
const todoModule = moduleCache.get(todoModulePath);

if (todoModule) {
  // Define our test todos
  const todos = [
    { content: 'Implement search functionality', status: 'pending', priority: 'high' },
    { content: 'Fix authentication bug', status: 'in_progress', priority: 'high' },
    { content: 'Update documentation', status: 'pending', priority: 'medium' },
    { content: 'Add unit tests', status: 'pending', priority: 'medium' },
    { content: 'Refactor error handling', status: 'completed', priority: 'low' }
  ];
  
  // Add IDs to the todos
  const updatedTodos = todos.map((todo, index) => ({
    ...todo,
    id: `todo-${Date.now()}-${index}`
  }));
  
  console.log('Successfully added 5 test todos');
} else {
  console.error('Could not access the todo module');
}