#!/usr/bin/env perl

use strict;
use warnings;

use Plack::Builder;

use Plack::Debugger;
use Plack::Debugger::Storage;

use Plack::App::Debugger;

use Plack::Debugger::Panel::PlackResponse;
use Plack::Debugger::Panel::Warnings;
use Plack::Debugger::Panel::AJAX;

my $debugger = Plack::Debugger->new(
    storage => Plack::Debugger::Storage->new( 
        data_dir     => './t/100-lpw-2014-examples/tmp/',
        serializer   => sub { $Plack::App::Debugger::JSON->encode( $_[0] ) },
        deserializer => sub { $Plack::App::Debugger::JSON->decode( $_[0] ) },
        filename_fmt => "%s.json",
    ),
    panels  => [ 
        Plack::Debugger::Panel::PlackResponse->new,
        Plack::Debugger::Panel::Warnings->new,
        Plack::Debugger::Panel::AJAX->new,
    ]
);

my $debugger_app = Plack::App::Debugger->new( debugger => $debugger );

builder {
    mount '/favicon.ico' => sub { [200,[],[]] };
    mount '/debugger'    => $debugger_app->to_app;
    mount '/'            => builder {
        enable $debugger_app->make_injector_middleware;
        enable $debugger->make_collector_middleware;
        sub {
            my $r = Plack::Request->new( shift );

            if ( $r->path_info eq '/api' ) {
                warn "Sending AJAX JSON response";
                return [ 
                    200, 
                    [ 'Content-Type' => 'application/json' ], 
                    [ q[{"test":[1,2,3]}] ]
                ]
            }
            elsif ( $r->path_info eq '/api/v2' ) {
                warn "Sending AJAX JSON error response";
                return [ 500, [], [] ];
            }
            else {
                return [ 
                    200, 
                    [ 'Content-Type' => 'text/html' ], 
                    [q[
                        <html>
                        <head>
                            <title>Plack::Debugger - Test 004</title>
                            <script type="text/javascript" src="/debugger/static/js/jquery.js"></script>
                            <script type="text/javascript">
                                $(document).ready(function () {
                                    $("#ajax-test").click(function () {
                                        $.get("/api", function (data) {
                                            console.log(data);
                                        });
                                    });

                                    $("#ajax-test-2").click(function () {
                                        $.get("/api/v2", function (data) {
                                            console.log(data);
                                        });
                                    });
                                });
                            </script>
                        </head>
                        <body>
                            <h1>Hello London!</h1>
                            <hr/>
                            <input id="ajax-test" type="button" value="TEST ME!" />
                            <br/>
                            <input id="ajax-test-2" type="button" value="BREAK ME!" />
                            <hr/>
                        </body>
                        </html>
                    ]]
                ]
            }
        }

    }
};

