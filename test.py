import threading
import os

def foo():
    print('This is foo', threading.get_native_id(), os.getpid())

def bar():
    print('This is bar', threading.get_native_id(), os.getpid())

def baz():
    print('This is baz', threading.get_native_id(), os.getpid())

if __name__ == '__main__':
    print('process id', os.getpid())
    thread1 = threading.Thread(target=foo).start()
    thread2 = threading.Thread(target=bar).start()
    thread3 = threading.Thread(target=baz).start()

# process id 60881
# This is foo 2466643 60881
# This is bar 2466644 60881
# This is baz 2466645 60881
