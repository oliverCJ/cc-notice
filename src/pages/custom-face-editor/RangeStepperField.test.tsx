import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RangeStepperField } from './RangeStepperField';

describe('RangeStepperField', () => {
  test('renders stepper buttons and a text value field instead of a spinbutton', () => {
    render(
      <RangeStepperField
        ariaLabel="缩放"
        decreaseLabel="减少缩放"
        description="描述"
        increaseLabel="增加缩放"
        label="缩放"
        max={4}
        min={0.25}
        step={0.05}
        value={1}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '减少缩放' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '增加缩放' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '缩放数值' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: '缩放数值' })).not.toBeInTheDocument();
  });

  test('changes value with plus and minus buttons and commits typed values on blur', () => {
    const onChange = vi.fn();
    render(
      <RangeStepperField
        ariaLabel="缩放"
        decreaseLabel="减少缩放"
        increaseLabel="增加缩放"
        label="缩放"
        max={4}
        min={0.25}
        step={0.05}
        value={1}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '减少缩放' }));
    fireEvent.click(screen.getByRole('button', { name: '增加缩放' }));
    fireEvent.change(screen.getByRole('textbox', { name: '缩放数值' }), { target: { value: '1.5' } });
    fireEvent.blur(screen.getByRole('textbox', { name: '缩放数值' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 0.95);
    expect(onChange).toHaveBeenNthCalledWith(2, 1.05);
    expect(onChange).toHaveBeenNthCalledWith(3, 1.5);
  });
});
