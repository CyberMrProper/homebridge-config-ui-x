import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TimerObservable } from 'rxjs/observable/TimerObservable';
import { ToastrService } from 'ngx-toastr';

import { ApiService } from '../../../../core/api.service';
import { WsService } from '../../../../core/ws.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-container-restart',
  templateUrl: './container-restart.component.html',
})
export class ContainerRestartComponent implements OnInit, OnDestroy {
  private io = this.$ws.connectToNamespace('status');

  checkTimeout;
  checkDelay;
  resp: any = {};
  timeout = false;
  error: any = false;

  constructor(
    private $api: ApiService,
    private $ws: WsService,
    private $auth: AuthService,
    public $toastr: ToastrService,
    private translate: TranslateService,
    private $router: Router,
  ) { }

  ngOnInit() {
    this.io.connected.subscribe(() => {
      this.io.socket.emit('monitor-server-status');
      this.$auth.getAppSettings().catch(/* do nothing */);
    });

    this.$api.put('/platform-tools/docker/restart-container', {}).subscribe(
      data => {
        this.resp = data;
        this.checkIfServerUp();
      },
      err => {
        const toastRestartError = this.translate.instant('restart.toast_server_restart_error');
        this.error = toastRestartError + '.';
        this.$toastr.error(`${toastRestartError}: ${err.message}`, this.translate.instant('toast.title_error'));
      },
    );
  }

  checkIfServerUp() {
    this.checkDelay = TimerObservable.create(10000).subscribe(() => {
      // listen to homebridge-status events to see when it's back online
      this.io.socket.on('homebridge-status', (data) => {
        if (data.status === 'up') {
          this.$toastr.success(
            this.translate.instant('platform.docker.restart_container.toast_container_restarted'),
            this.translate.instant('toast.title_success'),
          );
          this.$router.navigate(['/']);
        }
      });
    });

    this.checkTimeout = TimerObservable.create(60000).subscribe(() => {
      this.$toastr.warning(this.translate.instant('restart.toast_sever_restart_timeout'), this.translate.instant('toast.title_warning'), {
        timeOut: 10000,
      });
      this.timeout = true;
    });
  }

  ngOnDestroy() {
    this.io.end();

    if (this.checkDelay) {
      this.checkDelay.unsubscribe();
    }

    if (this.checkTimeout) {
      this.checkTimeout.unsubscribe();
    }
  }

}
