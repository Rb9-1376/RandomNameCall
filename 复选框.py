import tkinter
import pyttsx3

engine = pyttsx3.init()

def send():
    x = ""
    for j in cheakboxs:
        # 这里实际上是cheakboxs[j].get() == True
        # 如果被勾选的话传回来的值为True
        # 如果没有被勾选的话传回来的值为False
        if cheakboxs[j].get():
            x = x +foods[j] + "\n"
    print(x)

def read():
    # 获取 Entry 组件中的文本
    text = entry.get()
    if text:
        # 让语音引擎朗读文本
        engine.say(text)
        # 运行引擎并等待朗读完成
        engine.runAndWait()
# 创建主窗口
root = tkinter.Tk()
entry = tkinter.Entry(root, width=30)
entry.grid(row=0, column=0, columnspan=4, padx=5, pady=5, sticky=tkinter.W)


foods = {0: "打开语音播报"}
# 这里负责给予字典的键一个False或者True的值，用于检测是否被勾选
cheakboxs = {}
for i in range(len(foods)):
    # 这里相当于是{0: False, 1: False, 2: False, 3: False, 4: False}
    cheakboxs[i] = tkinter.BooleanVar()
    # 只有被勾选才变为True
    tkinter.Checkbutton(root, text=foods[i], variable=cheakboxs[i]).grid(row=i + 1, sticky=tkinter.W)

buttonOne = tkinter.Button(root, text="提交", width=10, command=send)
buttonOne.grid(row=len(foods) + 1)
butOne = tkinter.Button(root, text="朗读", command=read)
butOne.grid(row=1, column=0, padx=100, pady=5, sticky=tkinter.W)

root.mainloop()