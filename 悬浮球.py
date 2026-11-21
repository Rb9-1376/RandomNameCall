import tkinter as tk

class App:
    def __init__(self, master):
        self.master = master
        self.current_window = None

        # 创建主窗口
        self.create_main_window()

    def create_main_window(self):
        self.master.title("主窗口")
        tk.Label(self.master, text="这是主窗口").pack(pady=20)
        tk.Button(self.master, text="打开新窗口", command=self.open_new_window).pack(pady=10)

    def open_new_window(self):
        if self.current_window:
            self.current_window.destroy()
        self.current_window = tk.Toplevel(self.master)
        self.current_window.title("新窗口")
        tk.Label(self.current_window, text="这是新窗口").pack(pady=20)
        tk.Button(self.current_window, text="关闭并返回", command=self.close_new_window).pack(pady=10)

    def close_new_window(self):
        if self.current_window:
            self.current_window.destroy()
            self.current_window = None
        self.master.deiconify()  # 显示主窗口

if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()
