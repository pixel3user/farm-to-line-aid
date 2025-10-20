import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { CheckCircle, XCircle, Loader2, Database, User } from 'lucide-react';

const FirebaseTest: React.FC = () => {
  const [firebaseStatus, setFirebaseStatus] = useState<{
    connected: boolean;
    error?: string;
  }>({ connected: false });
  const [testResults, setTestResults] = useState<{
    writeTest: boolean | null;
    readTest: boolean | null;
    userTest: boolean | null;
  }>({
    writeTest: null,
    readTest: null,
    userTest: null
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    testFirebaseConnection();
  }, []);

  const testFirebaseConnection = async () => {
    try {
      setIsLoading(true);
      console.log('Testing Firebase connection...');
      
      if (!db) {
        throw new Error('Firebase database not initialized');
      }

      // Test basic connection by trying to read from a test collection
      const testRef = collection(db, 'test_connection');
      await getDocs(testRef);
      
      setFirebaseStatus({ connected: true });
      console.log('Firebase connection successful');
    } catch (error) {
      console.error('Firebase connection failed:', error);
      setFirebaseStatus({ 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runWriteTest = async () => {
    try {
      setIsLoading(true);
      const testRef = collection(db, 'test_data');
      await addDoc(testRef, {
        message: 'Test data from Farm2Market AI',
        timestamp: Timestamp.now(),
        testId: Math.random().toString(36).substr(2, 9)
      });
      setTestResults(prev => ({ ...prev, writeTest: true }));
      console.log('Write test successful');
    } catch (error) {
      console.error('Write test failed:', error);
      setTestResults(prev => ({ ...prev, writeTest: false }));
    } finally {
      setIsLoading(false);
    }
  };

  const runReadTest = async () => {
    try {
      setIsLoading(true);
      const testRef = collection(db, 'test_data');
      const snapshot = await getDocs(testRef);
      const documents = snapshot.docs.map(doc => doc.data());
      console.log('Read test successful, found documents:', documents.length);
      setTestResults(prev => ({ ...prev, readTest: true }));
    } catch (error) {
      console.error('Read test failed:', error);
      setTestResults(prev => ({ ...prev, readTest: false }));
    } finally {
      setIsLoading(false);
    }
  };

  const runUserTest = async () => {
    try {
      setIsLoading(true);
      // Test user collection access
      const usersRef = collection(db, 'line_users');
      const snapshot = await getDocs(usersRef);
      const users = snapshot.docs.map(doc => doc.data());
      console.log('User test successful, found users:', users.length);
      setTestResults(prev => ({ ...prev, userTest: true }));
    } catch (error) {
      console.error('User test failed:', error);
      setTestResults(prev => ({ ...prev, userTest: false }));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusBadge = (status: boolean | null) => {
    if (status === null) return <Badge variant="secondary">未測試</Badge>;
    return status ? (
      <Badge variant="default" className="bg-green-500">成功</Badge>
    ) : (
      <Badge variant="destructive">失敗</Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Firebase 連接測試</h1>
        <p className="text-muted-foreground">測試 Firebase 數據庫連接和功能</p>
      </div>

      {/* Firebase Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Firebase 連接狀態
          </CardTitle>
          <CardDescription>檢查 Firebase 數據庫是否正常連接</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {firebaseStatus.connected ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span>Firebase 連接</span>
            </div>
            <Badge variant={firebaseStatus.connected ? "default" : "destructive"}>
              {firebaseStatus.connected ? "已連接" : "連接失敗"}
            </Badge>
          </div>
          {firebaseStatus.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-600">錯誤: {firebaseStatus.error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>功能測試</CardTitle>
          <CardDescription>測試 Firebase 的各項功能</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(testResults.writeTest)}
              <span>寫入測試</span>
            </div>
            {getStatusBadge(testResults.writeTest)}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(testResults.readTest)}
              <span>讀取測試</span>
            </div>
            {getStatusBadge(testResults.readTest)}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(testResults.userTest)}
              <span>用戶數據測試</span>
            </div>
            {getStatusBadge(testResults.userTest)}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <Button 
          onClick={testFirebaseConnection} 
          disabled={isLoading}
          variant="outline"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              測試中...
            </>
          ) : (
            '重新測試連接'
          )}
        </Button>
        <Button 
          onClick={runWriteTest} 
          disabled={isLoading || !firebaseStatus.connected}
        >
          寫入測試
        </Button>
        <Button 
          onClick={runReadTest} 
          disabled={isLoading || !firebaseStatus.connected}
          variant="secondary"
        >
          讀取測試
        </Button>
        <Button 
          onClick={runUserTest} 
          disabled={isLoading || !firebaseStatus.connected}
          variant="outline"
        >
          用戶數據測試
        </Button>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>說明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>Firebase 連接</strong>: 檢查是否能連接到 Firebase 數據庫</p>
            <p>• <strong>寫入測試</strong>: 測試是否能向數據庫寫入數據</p>
            <p>• <strong>讀取測試</strong>: 測試是否能從數據庫讀取數據</p>
            <p>• <strong>用戶數據測試</strong>: 測試是否能訪問用戶數據集合</p>
            <p className="mt-4 text-blue-600">
              💡 如果所有測試都通過，說明 Firebase 配置正確，用戶數據將正常顯示
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirebaseTest;


