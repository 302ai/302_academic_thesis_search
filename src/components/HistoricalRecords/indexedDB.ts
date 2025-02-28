import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type Data = {
  summary: string;
  entry_id: string;
  title: string;
  authors: string;
  updated: number;
  pdf_url: string;
  translated_title: string;
  data_cid: string;
}

export interface IAIAcademicRecordList {
  id?: number;
  type: 'search' | 'summary' | 'translate',
  title: string;
  translateFiel?: string;
  summary?: {
    data: {
      history: string[],
      progress: number
    };
    item: Data,
    searchType: string
  };
  search?: {
    list: Data[],
    sortBy: 'relevance' | '-submitted_date',
    query: string,
    next_page: boolean,
    searchType: string,
    total_results: number,
  }
  created_at: string;
}

const DB_NAME = 'ai-academic-database';
const STORE_NAME = 'ai-academic-store';

interface MyDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: IAIAcademicRecordList
  };
}

export async function initDB(): Promise<IDBPDatabase<MyDB>> {
  const db = await openDB<MyDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
  return db;
}

export async function addData(data: IAIAcademicRecordList): Promise<IAIAcademicRecordList> {
  delete data.id;
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  // 返回插入数据后的主键值
  const id = await store.add(data);
  await tx.done;

  // 返回带有新生成 id 的数据
  return { ...data, id };
}

export async function getDataList(): Promise<IAIAcademicRecordList[]> {
  const db = await initDB();
  const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
  const allRecords = await store.getAll();
  //@ts-ignore
  const result = allRecords.sort((a, b) => b.id - a.id);
  return result;
}

// 删除
export async function deleteData(id: number): Promise<IAIAcademicRecordList[]> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).delete(id);
  await tx.done;
  const result = await getDataList();
  return result;
}