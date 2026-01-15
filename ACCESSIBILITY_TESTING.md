# Accessibility Testing Guide

This document provides guidance for testing the accessibility of the Stock Score application using screen readers and other accessibility tools.

## Overview

The application has been improved with comprehensive ARIA labels, proper semantic HTML, and keyboard navigation support. This guide will help you verify that these improvements work correctly with assistive technologies.

## Screen Readers

### Windows

#### NVDA (Free, Recommended)
1. **Download**: https://www.nvaccess.org/download/
2. **Installation**: Run the installer and follow the prompts
3. **Usage**:
   - Start NVDA (usually `Ctrl+Alt+N`)
   - Navigate the application using arrow keys
   - Use `Insert+F7` to open the elements list
   - Use `NVDA+Space` to toggle speech on/off

**Testing Checklist**:
- [ ] All buttons are announced with their purpose
- [ ] Form inputs are properly labeled
- [ ] Navigation menu items are clearly announced
- [ ] Table headers are announced when navigating cells
- [ ] Expand/collapse buttons indicate their state
- [ ] Error messages are announced
- [ ] Loading states are announced

#### JAWS (Commercial)
1. **Download**: https://www.freedomscientific.com/products/software/jaws/
2. **Usage**:
   - Start JAWS
   - Use `Insert+F3` to open the elements list
   - Use `Insert+Down Arrow` to read current line

### macOS

#### VoiceOver (Built-in)
1. **Enable**: System Preferences → Accessibility → VoiceOver (or `Cmd+F5`)
2. **Usage**:
   - Use `Control+Option+Right Arrow` to navigate forward
   - Use `Control+Option+Left Arrow` to navigate backward
   - Use `Control+Option+Space` to activate buttons
   - Use `Control+Option+H` to navigate by headings

**Testing Checklist**:
- [ ] All interactive elements are announced
- [ ] Form labels are read before input values
- [ ] Table navigation works correctly
- [ ] Modal dialogs are properly announced
- [ ] Dynamic content updates are announced

## Keyboard Navigation Testing

### Basic Navigation
- **Tab**: Move forward through interactive elements
- **Shift+Tab**: Move backward through interactive elements
- **Enter/Space**: Activate buttons and links
- **Arrow Keys**: Navigate within components (menus, tables, etc.)
- **Escape**: Close modals and dropdowns

### Testing Checklist
- [ ] All interactive elements are reachable via keyboard
- [ ] Focus indicators are visible
- [ ] Tab order is logical
- [ ] No keyboard traps
- [ ] Modals can be closed with Escape
- [ ] Dropdown menus can be navigated with arrow keys

## Automated Testing Tools

### axe DevTools (Browser Extension)
1. **Install**: Available for Chrome, Firefox, and Edge
2. **Usage**:
   - Open the application
   - Open browser DevTools
   - Navigate to "axe DevTools" tab
   - Click "Analyze" to scan the page
   - Review violations and warnings

### WAVE (Web Accessibility Evaluation Tool)
1. **Install**: Browser extension or use online tool at https://wave.webaim.org/
2. **Usage**:
   - Navigate to the application
   - Run WAVE analysis
   - Review errors, alerts, and features

### Lighthouse (Built into Chrome DevTools)
1. **Usage**:
   - Open Chrome DevTools
   - Navigate to "Lighthouse" tab
   - Select "Accessibility" category
   - Click "Generate report"
   - Review accessibility score and issues

## Manual Testing Checklist

### ARIA Labels
- [ ] All icon buttons have `aria-label` attributes
- [ ] All form inputs have associated labels
- [ ] All tables have `aria-label` or `aria-labelledby`
- [ ] All expandable sections have `aria-expanded` attributes
- [ ] All menus have `role="menu"` and `aria-label`
- [ ] All menu items have `role="menuitem"`

### Semantic HTML
- [ ] Headings are used in logical order (h1 → h2 → h3)
- [ ] Lists use proper `<ul>` or `<ol>` elements
- [ ] Buttons are used for actions, links for navigation
- [ ] Form elements are properly grouped with `<fieldset>` where appropriate

### Color and Contrast
- [ ] Text meets WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text)
- [ ] Information is not conveyed by color alone
- [ ] Focus indicators are visible in both light and dark themes

### Focus Management
- [ ] Focus is visible on all interactive elements
- [ ] Focus order is logical
- [ ] Focus is managed correctly in modals (trapped, returned on close)
- [ ] Skip links are available for main content

## Common Issues to Check

### Missing Labels
- Icon-only buttons without `aria-label`
- Form inputs without labels
- Images without alt text (if decorative, should have `aria-hidden="true"`)

### Incorrect ARIA Usage
- Using `role="button"` on elements that aren't buttons
- Missing `aria-expanded` on collapsible elements
- Incorrect `aria-checked` values

### Keyboard Issues
- Elements that can't be reached with keyboard
- Focus indicators that are too subtle
- Keyboard traps in modals or dropdowns

## Testing Specific Components

### Header Component
- [ ] Refresh button is announced correctly
- [ ] Theme selector menu items are announced
- [ ] Language selector menu items are announced
- [ ] User profile button is announced
- [ ] Logout button is announced

### Sidebar Navigation
- [ ] Navigation items are announced with their purpose
- [ ] Active page is indicated with `aria-current="page"`
- [ ] Collapsible sections indicate expanded/collapsed state
- [ ] Navigation structure is clear

### Tables
- [ ] Table headers are associated with cells
- [ ] Sortable columns indicate sort state
- [ ] Expand/collapse buttons for rows are clearly labeled
- [ ] Pagination controls are accessible

### Filters
- [ ] Filter button indicates active filter count
- [ ] Filter inputs are properly labeled
- [ ] Saved filters can be loaded and deleted via keyboard
- [ ] Clear filters button is accessible

## Reporting Issues

When reporting accessibility issues, please include:
1. **Component**: Which component has the issue
2. **Screen Reader**: Which screen reader you're using
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Steps to Reproduce**: How to trigger the issue

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Continuous Improvement

Accessibility is an ongoing effort. Regular testing should be performed:
- After major feature additions
- Before releases
- When updating dependencies
- When refactoring components

Consider adding accessibility checks to your CI/CD pipeline using tools like:
- [axe-core](https://github.com/dequelabs/axe-core)
- [pa11y](https://pa11y.org/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
