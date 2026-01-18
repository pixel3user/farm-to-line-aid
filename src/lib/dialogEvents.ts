export type DialogToggleDetail = {
  id: string;
  open: boolean;
};

export const DIALOG_TOGGLE_EVENT = 'app:dialog-open-change';

export const emitDialogToggle = (id: string, open: boolean) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DialogToggleDetail>(DIALOG_TOGGLE_EVENT, { detail: { id, open } }));
};
