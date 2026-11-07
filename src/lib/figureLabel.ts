// A figure's caption under its value: content/page 2.9.0 and whitepaper 1.4.0
// give a figure a `label` (what the value is) and a structured `measure`
// (money, quantity, fraction or date by reference to the open standard's
// units definitions), and deprecate `unit`, a free-text label that carried
// both meanings. A record that still carries only `unit` renders as before.
export interface LabelledFigure {
  label?: string;
  unit?: string;
}

export function figureLabel(figure: LabelledFigure): string | undefined {
  return figure.label ?? figure.unit;
}
