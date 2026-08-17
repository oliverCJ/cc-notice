import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { TemplateVariableHelper } from './TemplateVariableHelper';
import { TEMPLATE_VARIABLES } from './templateVariables';

describe('TemplateVariableHelper', () => {
  test('renders common variables with descriptions and supports inserting or copying tokens', () => {
    const onInsert = vi.fn();
    const onCopy = vi.fn();

    render(
      <TemplateVariableHelper
        variables={TEMPLATE_VARIABLES}
        onInsert={onInsert}
        onCopy={onCopy}
      />
    );

    expect(screen.getByText('变量助手')).toBeInTheDocument();
    expect(screen.getByText('公开变量来自上下文或安全摘要，不需要开启 debug；大字段会自动裁剪。')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '变量助手' })).not.toHaveClass('md:col-span-2');
    expect(screen.getByText('用户提示')).toBeInTheDocument();
    expect(screen.getAllByText('摘要裁剪').length).toBeGreaterThan(0);
    expect(screen.getByText('{{prompt}}')).toBeInTheDocument();
    expect(screen.getByText('UserPromptSubmit 事件中的 prompt 字段。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '插入 用户提示 变量' }));
    fireEvent.click(screen.getByRole('button', { name: '复制 用户提示 变量' }));

    expect(onInsert).toHaveBeenCalledWith('{{prompt}}');
    expect(onCopy).toHaveBeenCalledWith('{{prompt}}');
  });
});
