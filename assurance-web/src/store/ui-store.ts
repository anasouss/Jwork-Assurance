import { create } from "zustand";
import { persist } from "zustand/middleware";

type ModalType =
  | "createDossier"
  | "createClient"
  | "createUser"
  | "createRole"
  | "uploadDocument"
  | "confirmDelete"
  | null;

type UIState = {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  // Modal
  activeModal: ModalType;
  modalData: Record<string, unknown> | null;
  openModal: (modal: ModalType, data: Record<string, unknown>) => void;
  closeModal: () => void;
  // Toast messages are handled by sonner, but we can track them here if needed
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      // Modal
      activeModal: null,
      modalData: null,
      openModal: (modal, data = {}) => set({ activeModal: modal, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
    }),
    {
      name: "assurance-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
