import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardContent, CardFooter } from './Card';
import Button from './Button';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: 'Card content',
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: 'Outlined card',
  },
};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: 'Elevated card',
  },
};

export const WithHeader: Story = {
  render: () => (
    <Card>
      <CardHeader title="Card Title" subtitle="Card subtitle" />
      <CardContent>Card content goes here</CardContent>
    </Card>
  ),
};

export const Complete: Story = {
  render: () => (
    <Card>
      <CardHeader
        title="Complete Card"
        subtitle="This is a complete card example"
        action={<Button size="sm">Action</Button>}
      />
      <CardContent>
        <p>This is the main content of the card.</p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  ),
};
