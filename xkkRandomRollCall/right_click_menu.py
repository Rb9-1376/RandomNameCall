"""右键菜单"""
import webbrowser
import tkinter as tk

# undo=True
# expand=tk.YES, fill=tk.BOTH

class SetRightClickMenu:
    '''创建一个弹出菜单'''
    def __init__(self, text, undo=True):
        menu = tk.Menu(text,
                    tearoff=False,
                    )

        menu.add_command(label="剪切", command=lambda:text.event_generate('<<Cut>>'))
        menu.add_command(label="复制", command=lambda:text.event_generate('<<Copy>>'))
        menu.add_command(label="粘贴", command=lambda:text.event_generate('<<Paste>>'))
        menu.add_command(label="删除", command=lambda:text.event_generate('<<Clear>>'))
        if undo:
            menu.add_command(label="撤销", command=lambda:text.event_generate('<<Undo>>'))
            menu.add_command(label="重做", command=lambda:text.event_generate('<<Redo>>'))
        menu.add_separator()
        def popup(event):
            menu.post(event.x_root, event.y_root)   # post在指定的位置显示弹出菜单

        text.bind("<Button-3>", popup)

def main():
    """例子"""
    root = tk.Tk()
    root.title("右键菜单例子")
    root.geometry("500x300")
    t = tk.Text(root, width=51, font=("微软雅黑",10), undo=True)
    t.pack(expand=tk.YES, fill=tk.BOTH)
    content = """(｡･∀･)ﾉﾞ嗨
我支持右键菜单呢 <(￣︶￣)>
您可以尝试在我身上右键 (*/ω＼*)
(谭渝皓寄语：我是为了让您知道有这个功能才写的，实际上课过程中可能不会用到，比如语文杨老师)
"""
    t.insert(tk.INSERT,content)

    # 简单的加右键菜单
    SetRightClickMenu(t)
    
    root.mainloop()


if __name__ == "__main__":
    main()
