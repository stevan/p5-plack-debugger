#!/usr/bin/env perl

use strict;
use warnings;

use Plack::Builder;

use Plack::Debugger;
use Plack::Debugger::Storage;

use Plack::App::Debugger;

use Plack::Debugger::Panel::Timer;

my $debugger = Plack::Debugger->new(
    storage => Plack::Debugger::Storage->new( 
        data_dir     => './t/100-lpw-2014-examples/tmp/',
        serializer   => sub { $Plack::App::Debugger::JSON->encode( $_[0] ) },
        deserializer => sub { $Plack::App::Debugger::JSON->decode( $_[0] ) },
        filename_fmt => "%s.json",
    ),
    panels  => [ 
        Plack::Debugger::Panel->new(
            title     => 'Test Panel',
            formatter => 'nested_data',
            before    => sub { (shift)->notify('warning') },
            after => sub {
                my ($self, $env) = @_;
                $self->notify('error');
                $self->set_result({
                    testing => [
                        1, 2, 3, {
                            here => {
                                we    => 'go',
                                again => '!!'
                            }
                        }
                    ]
                });
            },
            metadata => {
                highlight_on_errors   => 1,
                highlight_on_warnings => 1,
            }
        ) 
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
            return [ 
                200, 
                [ 'Content-Type' => 'text/html' ], 
                [q[
                    <html>
                    <head><title>Plack::Debugger - Test 003</title></head>
                    <body><h1>Hello London!</h1></body>
                    </html>
                ]]
            ]
        }
    }
};

