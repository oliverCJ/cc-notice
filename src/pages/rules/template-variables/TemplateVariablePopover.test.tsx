import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { TemplateVariablePopover } from './TemplateVariablePopover';
import { TEMPLATE_VARIABLES } from './templateVariables';

describe('TemplateVariablePopover', () => {
  test('opens variable helper and closes it with Escape', () => {
    render(
      <TemplateVariablePopover
        variables={TEMPLATE_VARIABLES}
        onInsert={vi.fn()}
        onCopy={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '打开变量助手' }));
    expect(screen.getByRole('region', { name: '变量助手' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: '变量助手' })).not.toBeInTheDocument();
  });
});
