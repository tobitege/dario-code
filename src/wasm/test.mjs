#!/usr/bin/env node

/**
 * Test script for WASM UI
 * This script runs tests on the WASM UI components
 */

import { loadYoga } from './yoga-loader.mjs';
import { LayoutComponent, createRootLayout } from './layout-engine.mjs';
import { UIComponent, Box, Text, Input, Button, ProgressBar } from './ui-components.mjs';

/**
 * Test the yoga loader
 */
async function testYogaLoader() {
  
  try {
    const yoga = await loadYoga();
    
    // Test creating a node
    const node = yoga.Node.create();
    
    // Test setting properties
    node.setWidth(100);
    node.setHeight(100);
    
    // Test calculating layout
    node.calculateLayout();
    
    // Test getting computed values
    const width = node.getComputedWidth();
    const height = node.getComputedHeight();
    
    // Test cleanup
    node.free();
    
  } catch (error) {
    console.error('❌ Yoga loader test failed:', error);
    throw error;
  }
}

/**
 * Test the layout engine
 */
async function testLayoutEngine() {
  
  try {
    // Create a root layout
    const root = await createRootLayout({ width: 80, height: 24 });
    
    // Create child components
    const child1 = new LayoutComponent({
      width: 40,
      height: 10,
    });
    
    const child2 = new LayoutComponent({
      width: 40,
      height: 10,
    });
    
    // Initialize with Yoga
    const yoga = await loadYoga();
    child1.init(yoga);
    child2.init(yoga);
    
    // Add children
    root.addChild(child1);
    root.addChild(child2);
    
    // Calculate layout
    root.calculateLayout();
    
    // Get computed layouts
    const rootLayout = root.getComputedLayout();
    const child1Layout = child1.getComputedLayout();
    const child2Layout = child2.getComputedLayout();
    
    
    // Cleanup
    root.cleanup();
    
  } catch (error) {
    console.error('❌ Layout engine test failed:', error);
    throw error;
  }
}

/**
 * Test UI components
 */
async function testUIComponents() {
  
  try {
    // Create mock rendering context
    const mockContext = {
      setCell: (x, y, char, styles) => {
      },
      drawText: (x, y, text, styles) => {
      },
    };
    
    // Create components
    const yoga = await loadYoga();
    
    // Test UIComponent
    const component = new UIComponent({
      width: 10,
      height: 5,
      content: 'Test',
    });
    component.init(yoga);
    component.render(mockContext);
    
    // Test Box
    const box = new Box({
      width: 20,
      height: 10,
      border: true,
    });
    box.init(yoga);
    box.render(mockContext);
    
    // Test Text
    const text = new Text({
      text: 'Hello, World!',
    });
    text.init(yoga);
    text.render(mockContext);
    
    // Test Input
    const input = new Input({
      placeholder: 'Type here...',
      value: 'Test input',
    });
    input.init(yoga);
    input.render(mockContext);
    
    // Test Button
    const button = new Button({
      label: 'Click Me',
    });
    button.init(yoga);
    button.render(mockContext);
    
    // Test ProgressBar
    const progressBar = new ProgressBar({
      value: 50,
    });
    progressBar.init(yoga);
    progressBar.render(mockContext);
    
    // Test component nesting
    box.addChild(text);
    box.addChild(input);
    box.render(mockContext);
    
    // Test cleanup
    component.cleanup();
    box.cleanup();
    
  } catch (error) {
    console.error('❌ UI components test failed:', error);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  
  try {
    // Run tests
    await testYogaLoader();
    await testLayoutEngine();
    await testUIComponents();
    
    // All tests passed
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests();