import {Injectable, isDevMode} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(private http: HttpClient) {
  }

  getData(fileName: string): Observable<any> {
    return this.http.get(`assets/${fileName}.json`);
  }

  getSizeTree(): Observable<any> {
    if (isDevMode()) {
      return this.http.get('assets/size_tree.json');
    }
    return this.http.get(`size_tree.json`, {params: {t: String(Date.now())}})
  }

  getInfo(): Observable<Info> {
    if (isDevMode()) {
      return this.http.get<Info>('assets/info.json');
    }
    return this.http.get<Info>('info');
  }

}

export interface Info {
  sep: string;
}
