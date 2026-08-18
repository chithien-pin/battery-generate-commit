#include <iostream>
using namespace std;

struct Node {
    int data;
    Node* next;
};

void pushBack(Node*& head, int value) {
    Node* newNode = new Node{value, nullptr};

    if (head == nullptr) {
        head = newNode;
        return;
    }

    Node* temp = head;
    while (temp->next != nullptr) {
        temp = temp->next;
    }
    temp->next = newNode;
}

void inputList(Node*& head) {
    int n;
    cout << "Nhap so phan tu: ";
    cin >> n;

    for (int i = 0; i < n; i++) {
        int x;
        cout << "Nhap phan tu thu " << i + 1 << ": ";
        cin >> x;
        pushBack(head, x);
    }
}

void printList(Node* head) {
    while (head != nullptr) {
        cout << head->data << " -> ";
        head = head->next;
    }
    cout << "NULL";
}

int main() {
    Node* head = nullptr;

    inputList(head);
    cout << "Danh sach vua nhap: ";
    printList(head);

    return 0;
}