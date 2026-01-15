import type { Meta, StoryObj } from '@storybook/react';
import Select from './Select';

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Select>;

const options = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
  { value: '4', label: 'Option 4' },
];

export const Default: Story = {
  args: {
    options,
    placeholder: 'Select an option',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Choose an option',
    options,
    placeholder: 'Select...',
  },
};

export const WithError: Story = {
  args: {
    label: 'Choose an option',
    options,
    error: 'Please select an option',
  },
};

export const Required: Story = {
  args: {
    label: 'Country',
    options: [
      { value: 'se', label: 'Sweden' },
      { value: 'no', label: 'Norway' },
      { value: 'dk', label: 'Denmark' },
    ],
    required: true,
  },
};
